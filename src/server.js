import express from 'express';
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
  if (id !== req.user.id) return res.status(403).json({ error: 'Sem acesso a este álbum.' });
  const { missing, duplicates } = await getUserStickers(id);
  res.json({ user: publicUser(req.user), missing: decorate(missing), duplicates: decorate(duplicates) });
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

// NOTA: amizades por convite/aceite e grupos chegam nas Fases 2 e 3
// (substituem o antigo cruzamento automatico entre todos os usuarios).

// ---------- boot ----------
initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Álbum da Copa rodando em http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Falha ao inicializar o banco de dados:', err);
    process.exit(1);
  });
