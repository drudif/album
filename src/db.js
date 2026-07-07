import pg from 'pg';

const { Pool } = pg;

// O Railway injeta DATABASE_URL ao referenciar o servico de Postgres.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn(
    '[db] DATABASE_URL nao definida. Configure um Postgres (no Railway, ' +
    'referencie o servico: DATABASE_URL=${{Postgres.DATABASE_URL}}).'
  );
}

// Conexoes internas do Railway (*.railway.internal) nao usam SSL.
// Para conexoes externas, defina DATABASE_SSL=require (ou sslmode=require na URL).
const useSsl =
  /sslmode=require/.test(connectionString || '') ||
  process.env.DATABASE_SSL === 'require' ||
  process.env.PGSSLMODE === 'require';

export const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: Number(process.env.PG_POOL_MAX || 10),
});

// Helpers
export const query = (text, params) => pool.query(text, params);
export const rows = async (text, params) => (await pool.query(text, params)).rows;
export const first = async (text, params) => (await pool.query(text, params)).rows[0] || null;

// Executa fn dentro de uma transacao (recebe um client dedicado).
export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Cria as tabelas se nao existirem. Chamada no boot do servidor.
export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      apartment  TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS user_stickers (
      user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code     TEXT NOT NULL,
      status   TEXT NOT NULL,
      PRIMARY KEY (user_id, code)
    );

    CREATE INDEX IF NOT EXISTS idx_user_stickers_code   ON user_stickers(code);
    CREATE INDEX IF NOT EXISTS idx_user_stickers_status ON user_stickers(status);

    -- Sessoes (login por usuario/senha). Guarda o hash do token, nao o token.
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);

  // Amizades (mutuas, apos aceite). Convencao user_a < user_b.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS friendships (
      user_a     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_a, user_b),
      CHECK (user_a < user_b)
    );
  `);

  // Grupos: membros convidados que aceitam participar. Cruzamento e albuns
  // visiveis entre todos os membros.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS groups (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL,
      owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invite_token TEXT UNIQUE NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS group_members (
      group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (group_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
  `);

  // Migracoes idempotentes (bancos ja existentes).
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS age_confirmed BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE users ALTER COLUMN apartment DROP NOT NULL;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token TEXT;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_token ON users(invite_token) WHERE invite_token IS NOT NULL;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false;`);
  // status agora também guarda a cor das legends (roxa/bronze/prata/dourada),
  // então a checagem antiga de dois valores sai.
  await pool.query(`ALTER TABLE user_stickers DROP CONSTRAINT IF EXISTS user_stickers_status_check;`);
}
