import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { query, rows, first, withTx, initDb } from './db.js';
import { catalog } from './catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;

// Envolve handlers async para capturar erros e responder 500.
const h = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Erro interno do servidor.' });
  });

// ---------- helpers ----------

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, apartment: u.apartment };
}

function getUser(id) {
  return first('SELECT * FROM users WHERE id = $1', [id]);
}

// Retorna { missing: [codes], duplicates: [codes] } de um usuario.
async function getUserStickers(userId) {
  const list = await rows('SELECT code, status FROM user_stickers WHERE user_id = $1', [userId]);
  const missing = [];
  const duplicates = [];
  for (const r of list) {
    if (r.status === 'missing') missing.push(r.code);
    else duplicates.push(r.code);
  }
  return { missing, duplicates };
}

function decorate(codes) {
  return codes
    .map((c) => catalog.byCode.get(c))
    .filter(Boolean)
    .sort((a, b) => a.code.localeCompare(b.code));
}

// ---------- catalogo ----------

app.get('/api/catalog', (req, res) => {
  res.json({
    sections: catalog.sections,
    total: catalog.stickers.length,
  });
});

// ---------- cadastro / login ----------

app.post('/api/register', h(async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const apartment = (req.body.apartment || '').trim();

  if (!name || !email || !apartment) {
    return res.status(400).json({ error: 'Preencha nome, email e apartamento.' });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Email invalido.' });
  }

  const existing = await first('SELECT * FROM users WHERE email = $1', [email]);
  if (existing) {
    // Login amigavel: se ja existe, retorna o perfil (atualiza nome/apto).
    await query('UPDATE users SET name = $1, apartment = $2 WHERE id = $3', [
      name,
      apartment,
      existing.id,
    ]);
    return res.json({ user: publicUser(await getUser(existing.id)), returning: true });
  }

  const inserted = await first(
    'INSERT INTO users (name, email, apartment) VALUES ($1, $2, $3) RETURNING *',
    [name, email, apartment]
  );
  res.json({ user: publicUser(inserted), returning: false });
}));

app.post('/api/login', h(async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const user = await first('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) {
    return res.status(404).json({ error: 'Email nao cadastrado. Faca seu cadastro.' });
  }
  res.json({ user: publicUser(user) });
}));

// ---------- usuarios / perfis ----------

app.get('/api/users', h(async (req, res) => {
  const users = await rows('SELECT * FROM users ORDER BY lower(name)');
  const counts = await rows(
    `SELECT user_id,
            COUNT(*) FILTER (WHERE status = 'missing')   AS missing,
            COUNT(*) FILTER (WHERE status = 'duplicate') AS duplicates
     FROM user_stickers GROUP BY user_id`
  );
  const cmap = new Map(counts.map((c) => [c.user_id, c]));
  const out = users.map((u) => {
    const c = cmap.get(u.id);
    return {
      ...publicUser(u),
      missing: Number(c?.missing || 0),
      duplicates: Number(c?.duplicates || 0),
    };
  });
  res.json({ users: out });
}));

app.get('/api/users/:id', h(async (req, res) => {
  const user = await getUser(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Usuario nao encontrado.' });
  const { missing, duplicates } = await getUserStickers(user.id);
  res.json({
    user: publicUser(user),
    missing: decorate(missing),
    duplicates: decorate(duplicates),
  });
}));

// Salva a lista de figurinhas do usuario (substitui o estado atual).
app.put('/api/users/:id/stickers', h(async (req, res) => {
  const user = await getUser(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Usuario nao encontrado.' });

  const missing = Array.isArray(req.body.missing) ? req.body.missing : [];
  const duplicates = Array.isArray(req.body.duplicates) ? req.body.duplicates : [];

  // Valida e dedup contra o catalogo. Uma figurinha nao pode estar nas duas listas.
  const dupSet = new Set(duplicates.filter((c) => catalog.byCode.has(c)));
  const missSet = new Set(
    missing.filter((c) => catalog.byCode.has(c) && !dupSet.has(c))
  );

  const codes = [...missSet, ...dupSet];
  const statuses = [...missSet].map(() => 'missing').concat([...dupSet].map(() => 'duplicate'));

  await withTx(async (client) => {
    await client.query('DELETE FROM user_stickers WHERE user_id = $1', [user.id]);
    if (codes.length) {
      await client.query(
        `INSERT INTO user_stickers (user_id, code, status)
         SELECT $1, * FROM unnest($2::text[], $3::text[])`,
        [user.id, codes, statuses]
      );
    }
  });

  res.json({
    missing: decorate([...missSet]),
    duplicates: decorate([...dupSet]),
  });
}));

// ---------- busca por figurinha ----------
// Quem tem repetida (oferece) e quem precisa, de um codigo ou nome de pais.

app.get('/api/search', h(async (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.json({ results: [] });

  // Acha os codigos que batem com a busca (codigo, label ou pais/secao).
  const codes = catalog.stickers
    .filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.label.toLowerCase().includes(q) ||
        s.section.toLowerCase().includes(q)
    )
    .map((s) => s.code);

  if (codes.length === 0) return res.json({ results: [] });

  const list = await rows(
    `SELECT us.code, us.status, u.id AS user_id, u.name, u.apartment, u.email
     FROM user_stickers us
     JOIN users u ON u.id = us.user_id
     WHERE us.code = ANY($1)
     ORDER BY us.code`,
    [codes]
  );

  // Agrupa por figurinha.
  const map = new Map();
  for (const code of codes) {
    const sticker = catalog.byCode.get(code);
    map.set(code, { sticker, offers: [], needs: [] });
  }
  for (const r of list) {
    const entry = map.get(r.code);
    const person = { id: r.user_id, name: r.name, apartment: r.apartment };
    if (r.status === 'duplicate') entry.offers.push(person);
    else entry.needs.push(person);
  }

  // So retorna figurinhas com pelo menos alguem envolvido.
  const results = [...map.values()].filter((e) => e.offers.length || e.needs.length);
  res.json({ results });
}));

// ---------- cruzamentos (matches) ----------
// Para um usuario: com quem ele pode trocar.
//   youGive: repetidas dele que o outro precisa
//   youGet : repetidas do outro que ele precisa

app.get('/api/users/:id/matches', h(async (req, res) => {
  const me = await getUser(Number(req.params.id));
  if (!me) return res.status(404).json({ error: 'Usuario nao encontrado.' });

  const mine = await getUserStickers(me.id);
  const myDup = new Set(mine.duplicates);
  const myMiss = new Set(mine.missing);

  const others = await rows('SELECT * FROM users WHERE id != $1', [me.id]);

  // Carrega as figurinhas de todo mundo (menos eu) de uma vez e agrupa.
  const allStickers = await rows(
    'SELECT user_id, code, status FROM user_stickers WHERE user_id != $1',
    [me.id]
  );
  const byUser = new Map();
  for (const r of allStickers) {
    let e = byUser.get(r.user_id);
    if (!e) {
      e = { duplicates: new Set(), missing: new Set() };
      byUser.set(r.user_id, e);
    }
    (r.status === 'duplicate' ? e.duplicates : e.missing).add(r.code);
  }

  const matches = [];
  for (const other of others) {
    const theirs = byUser.get(other.id) || { duplicates: new Set(), missing: new Set() };

    // Eu dou: minhas repetidas que o outro precisa.
    const youGive = [...myDup].filter((c) => theirs.missing.has(c));
    // Eu recebo: repetidas do outro que eu preciso.
    const youGet = [...theirs.duplicates].filter((c) => myMiss.has(c));

    if (youGive.length || youGet.length) {
      matches.push({
        user: publicUser(other),
        youGive: decorate(youGive),
        youGet: decorate(youGet),
        // Trocas "perfeitas" (mao dupla) sao as mais valiosas.
        mutual: Math.min(youGive.length, youGet.length),
        score: youGive.length + youGet.length,
      });
    }
  }

  // Ordena: trocas mutuas primeiro, depois volume total.
  matches.sort((a, b) => b.mutual - a.mutual || b.score - a.score);
  res.json({ matches });
}));

// ---------- boot ----------

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Álbum da Copa rodando em http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Falha ao inicializar o banco de dados:', err);
    process.exit(1);
  });
