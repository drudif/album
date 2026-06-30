import crypto from 'crypto';
import { query, first } from './db.js';

// ---------- senha (scrypt, sem dependencias) ----------
const SCRYPT_N = 16384, KEYLEN = 64;

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, KEYLEN, { N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(pw, stored) {
  try {
    if (!stored) return false;
    const [alg, n, saltHex, hashHex] = stored.split('$');
    if (alg !== 'scrypt') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const got = crypto.scryptSync(pw, salt, expected.length, { N: Number(n) });
    return got.length === expected.length && crypto.timingSafeEqual(expected, got);
  } catch {
    return false;
  }
}

// ---------- sessoes (token aleatorio; guardamos o hash) ----------
const SESSION_DAYS = 30;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [sha256(token), userId, expires.toISOString()]
  );
  return { token, expires };
}

export async function getSessionUser(token) {
  if (!token) return null;
  const row = await first(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)]
  );
  return row || null;
}

export async function destroySession(token) {
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
}

// ---------- cookies ----------
export const COOKIE = 'album_sess';

export function parseCookies(req) {
  const out = {};
  const h = req.headers.cookie;
  if (!h) return out;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setSessionCookie(res, token, expires) {
  const prod = process.env.NODE_ENV === 'production';
  const parts = [`${COOKIE}=${token}`, 'HttpOnly', 'Path=/', 'SameSite=Lax', `Expires=${expires.toUTCString()}`];
  if (prod) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res) {
  res.append('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

// ---------- Cloudflare Turnstile (verificacao humano/bot) ----------
// Defaults = chaves de TESTE da Cloudflare (sempre passam) para dev local.
// Em producao, defina TURNSTILE_SITE_KEY e TURNSTILE_SECRET_KEY reais.
const TS_SITE = process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA';
const TS_SECRET = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';

export function turnstileSiteKey() {
  return TS_SITE;
}

export async function verifyTurnstile(token, ip) {
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: TS_SECRET, response: token });
    if (ip) body.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = await r.json();
    return !!data.success;
  } catch {
    return false;
  }
}
