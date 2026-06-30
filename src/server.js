import express from 'express';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import { query, rows, first, withTx, initDb } from './db.js';
import { catalog } from './catalog.js';
import {
  hashPassword, verifyPassword,
  createSession, getSessionUser, destroySession,
  COOKIE, parseCookies, setSessionCookie, clearSessionCookie,
  turnstileSiteKey, verifyTurnstile,
} from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Envolve handlers async para capturar erros e responder 500.
const h = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Erro interno do servidor.' });
  });

// Cookies + usuario da sessao em cada request.
app.use((req, res, next) => { req.cookies = parseCookies(req); next(); });
async function loadUser(req) {
  if (!req._userLoaded) { req.user = await getSessionUser(req.cookies[COOKIE]); req._userLoaded = true; }
  return req.user;
}
const requireAuth = (req, res, next) =>
  loadUser(req).then((u) => {
    if (!u) return res.status(401).json({ error: 'Faça login para continuar.' });
    next();
  }).catch(next);

const clientIp = (req) =>
  req.headers['cf-connecting-ip'] ||
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  req.socket.remoteAddress;

// ---------- helpers ----------
function publicUser(u) {
  if (!u) return null;
  const o = { id: u.id, name: u.name, email: u.email };
  if (u.apartment) o.apartment = u.apartment;
  return o;
}
function getUser(id) { return first('SELECT * FROM users WHERE id = $1', [id]); }
async function getUserStickers(userId) {
  const list = await rows('SELECT code, status FROM user_stickers WHERE user_id = $1', [userId]);
  const missing = [], duplicates = [];
  for (const r of list) (r.status === 'missing' ? missing : duplicates).push(r.code);
  return { missing, duplicates };
}
function decorate(codes) {
  return codes.map((c) => catalog.byCode.get(c)).filter(Boolean).sort((a, b) => a.code.localeCompare(b.code));
}

// ---------- amizades ----------
async function getFriendIds(uid) {
  const r = await rows('SELECT user_a, user_b FROM friendships WHERE user_a = $1 OR user_b = $1', [uid]);
  return r.map((x) => (x.user_a === uid ? x.user_b : x.user_a));
}
async function areFriends(a, b) {
  if (a === b) return true;
  const [x, y] = a < b ? [a, b] : [b, a];
  return !!(await first('SELECT 1 FROM friendships WHERE user_a = $1 AND user_b = $2', [x, y]));
}
async function addFriendship(a, b) {
  const [x, y] = a < b ? [a, b] : [b, a];
  await query('INSERT INTO friendships (user_a, user_b) VALUES ($1, $2) ON CONFLICT DO NOTHING', [x, y]);
}
// Cruza minhas figurinhas com as de um conjunto de usuarios.
async function crossWith(meId, otherIds) {
  if (!otherIds.length) return [];
  const mine = await getUserStickers(meId);
  const myDup = new Set(mine.duplicates), myMiss = new Set(mine.missing);
  const all = await rows(
    'SELECT user_id, code, status FROM user_stickers WHERE user_id = ANY($1)', [otherIds]
  );
  const byUser = new Map();
  for (const r of all) {
    let e = byUser.get(r.user_id);
    if (!e) { e = { dup: new Set(), miss: new Set() }; byUser.set(r.user_id, e); }
    (r.status === 'duplicate' ? e.dup : e.miss).add(r.code);
  }
  const users = await rows('SELECT * FROM users WHERE id = ANY($1)', [otherIds]);
  const out = [];
  for (const other of users) {
    const t = byUser.get(other.id) || { dup: new Set(), miss: new Set() };
    const youGive = [...myDup].filter((c) => t.miss.has(c));
    const youGet = [...t.dup].filter((c) => myMiss.has(c));
    if (youGive.length || youGet.length) {
      out.push({
        user: publicUser(other),
        youGive: decorate(youGive),
        youGet: decorate(youGet),
        mutual: Math.min(youGive.length, youGet.length),
        score: youGive.length + youGet.length,
      });
    }
  }
  out.sort((a, b) => b.mutual - a.mutual || b.score - a.score);
  return out;
}

// ---------- config publica (site key do Turnstile) ----------
app.get('/api/config', (req, res) => {
  res.json({ turnstileSiteKey: turnstileSiteKey() });
});

// ---------- catalogo ----------
app.get('/api/catalog', (req, res) => {
  res.json({ sections: catalog.sections, total: catalog.stickers.length });
});

// ---------- cadastro / login / sessao ----------
app.post('/api/register', h(async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const ageConfirmed = req.body.ageConfirmed === true;
  const tsToken = req.body.turnstileToken || '';

  if (!name || !email || !password) return res.status(400).json({ error: 'Preencha nome, email e senha.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email inválido.' });
  if (password.length < 8) return res.status(400).json({ error: 'A senha precisa ter ao menos 8 caracteres.' });
  if (!ageConfirmed) return res.status(400).json({ error: 'Você precisa declarar ter 18 anos ou mais.' });
  if (!(await verifyTurnstile(tsToken, clientIp(req)))) {
    return res.status(400).json({ error: 'Verificação de humano falhou. Tente novamente.' });
  }

  const existing = await first('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) return res.status(409).json({ error: 'Email já cadastrado. Faça login.' });

  const u = await first(
    'INSERT INTO users (name, email, password_hash, age_confirmed) VALUES ($1, $2, $3, true) RETURNING *',
    [name, email, hashPassword(password)]
  );
  const { token, expires } = await createSession(u.id);
  setSessionCookie(res, token, expires);
  res.json({ user: publicUser(u) });
}));

app.post('/api/login', h(async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const tsToken = req.body.turnstileToken || '';

  if (!(await verifyTurnstile(tsToken, clientIp(req)))) {
    return res.status(400).json({ error: 'Verificação de humano falhou. Tente novamente.' });
  }
  const user = await first('SELECT * FROM users WHERE email = $1', [email]);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email ou senha incorretos.' });
  }
  const { token, expires } = await createSession(user.id);
  setSessionCookie(res, token, expires);
  res.json({ user: publicUser(user) });
}));

app.post('/api/logout', h(async (req, res) => {
  await destroySession(req.cookies[COOKIE]);
  clearSessionCookie(res);
  res.json({ ok: true });
}));

app.get('/api/me', h(async (req, res) => {
  const u = await loadUser(req);
  if (!u) return res.status(401).json({ error: 'Não autenticado.' });
  res.json({ user: publicUser(u) });
}));

// ---------- album do usuario (escopo: o proprio) ----------
app.get('/api/users/:id', requireAuth, h(async (req, res) => {
  const id = Number(req.params.id);
  // Visivel para o proprio dono ou para amigos (apos aceite).
  if (id !== req.user.id && !(await areFriends(req.user.id, id))) {
    return res.status(403).json({ error: 'Sem acesso a este álbum.' });
  }
  const target = id === req.user.id ? req.user : await getUser(id);
  if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });
  const { missing, duplicates } = await getUserStickers(id);
  res.json({ user: publicUser(target), missing: decorate(missing), duplicates: decorate(duplicates) });
}));

app.put('/api/users/:id/stickers', requireAuth, h(async (req, res) => {
  const id = Number(req.params.id);
  if (id !== req.user.id) return res.status(403).json({ error: 'Você só pode editar o seu álbum.' });

  const missing = Array.isArray(req.body.missing) ? req.body.missing : [];
  const duplicates = Array.isArray(req.body.duplicates) ? req.body.duplicates : [];
  const dupSet = new Set(duplicates.filter((c) => catalog.byCode.has(c)));
  const missSet = new Set(missing.filter((c) => catalog.byCode.has(c) && !dupSet.has(c)));

  const codes = [...missSet, ...dupSet];
  const statuses = [...missSet].map(() => 'missing').concat([...dupSet].map(() => 'duplicate'));
  await withTx(async (client) => {
    await client.query('DELETE FROM user_stickers WHERE user_id = $1', [id]);
    if (codes.length) {
      await client.query(
        `INSERT INTO user_stickers (user_id, code, status)
         SELECT $1, * FROM unnest($2::text[], $3::text[])`,
        [id, codes, statuses]
      );
    }
  });
  res.json({ missing: decorate([...missSet]), duplicates: decorate([...dupSet]) });
}));

// ---------- amizades (convite por link + aceite) ----------

// Meu link de convite (gera o token na primeira vez).
app.get('/api/friends/link', requireAuth, h(async (req, res) => {
  let token = req.user.invite_token;
  if (!token) {
    token = crypto.randomBytes(12).toString('base64url');
    await query('UPDATE users SET invite_token = $1 WHERE id = $2', [token, req.user.id]);
  }
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0];
  const url = `${proto}://${req.get('host')}/?convite=${token}`;
  res.json({ token, url });
}));

// Quem está convidando (para confirmar antes de aceitar).
app.get('/api/friends/invite/:token', requireAuth, h(async (req, res) => {
  const inviter = await first('SELECT id, name FROM users WHERE invite_token = $1', [req.params.token]);
  if (!inviter) return res.status(404).json({ error: 'Convite inválido ou expirado.' });
  res.json({ inviter: { id: inviter.id, name: inviter.name }, isSelf: inviter.id === req.user.id });
}));

// Aceitar o convite -> cria a amizade (mutua).
app.post('/api/friends/accept', requireAuth, h(async (req, res) => {
  const token = (req.body.token || '').trim();
  const inviter = await first('SELECT * FROM users WHERE invite_token = $1', [token]);
  if (!inviter) return res.status(404).json({ error: 'Convite inválido ou expirado.' });
  if (inviter.id === req.user.id) return res.status(400).json({ error: 'Esse é o seu próprio convite. 🙂' });
  await addFriendship(req.user.id, inviter.id);
  res.json({ friend: publicUser(inviter) });
}));

// Meus amigos (com contagens).
app.get('/api/friends', requireAuth, h(async (req, res) => {
  const ids = await getFriendIds(req.user.id);
  if (!ids.length) return res.json({ friends: [] });
  const users = await rows('SELECT * FROM users WHERE id = ANY($1) ORDER BY lower(name)', [ids]);
  const counts = await rows(
    `SELECT user_id,
            COUNT(*) FILTER (WHERE status = 'missing')   AS missing,
            COUNT(*) FILTER (WHERE status = 'duplicate') AS duplicates
     FROM user_stickers WHERE user_id = ANY($1) GROUP BY user_id`, [ids]
  );
  const cmap = new Map(counts.map((c) => [c.user_id, c]));
  res.json({
    friends: users.map((u) => {
      const c = cmap.get(u.id);
      return { ...publicUser(u), missing: Number(c?.missing || 0), duplicates: Number(c?.duplicates || 0) };
    }),
  });
}));

// Trocas: cruzamento entre mim e todos os meus amigos.
app.get('/api/matches', requireAuth, h(async (req, res) => {
  const ids = await getFriendIds(req.user.id);
  res.json({ matches: await crossWith(req.user.id, ids) });
}));

// Cruzamento pareado com um amigo especifico.
app.get('/api/users/:id/matches', requireAuth, h(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await areFriends(req.user.id, id))) return res.status(403).json({ error: 'Vocês não são amigos.' });
  const list = await crossWith(req.user.id, [id]);
  res.json({ matches: list });
}));

// NOTA: grupos chegam na Fase 3.

// ---------- boot ----------
initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Álbum da Copa rodando em http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Falha ao inicializar o banco de dados:', err);
    process.exit(1);
  });
