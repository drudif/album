// Popula o banco com vizinhos de exemplo para experimentar o app.
// Uso: DATABASE_URL=... npm run seed   (depois: npm start)
import { pool, initDb } from './db.js';
import { catalog } from './catalog.js';

const codes = catalog.stickers.map((s) => s.code);
const pick = (arr, n, offset) => {
  // Escolha deterministica (sem aleatoriedade) para resultados estaveis.
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[(offset + i * 7) % arr.length]);
  return [...new Set(out)];
};

const people = [
  { name: 'Ana Souza', email: 'ana@predio.com', apartment: '101', mOff: 3, dOff: 200 },
  { name: 'Bruno Lima', email: 'bruno@predio.com', apartment: '202', mOff: 200, dOff: 3 },
  { name: 'Carla Dias', email: 'carla@predio.com', apartment: '303', mOff: 90, dOff: 450 },
  { name: 'Diego Alves', email: 'diego@predio.com', apartment: '404 Bloco B', mOff: 450, dOff: 90 },
];

async function run() {
  await initDb();

  for (const p of people) {
    const { rows: [u] } = await pool.query(
      `INSERT INTO users (name, email, apartment) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET name = excluded.name, apartment = excluded.apartment
       RETURNING id`,
      [p.name, p.email, p.apartment]
    );

    await pool.query('DELETE FROM user_stickers WHERE user_id = $1', [u.id]);

    const missing = pick(codes, 35, p.mOff);
    const dups = pick(codes, 35, p.dOff).filter((c) => !missing.includes(c));

    const allCodes = [...missing, ...dups];
    const statuses = missing.map(() => 'missing').concat(dups.map(() => 'duplicate'));
    if (allCodes.length) {
      await pool.query(
        `INSERT INTO user_stickers (user_id, code, status)
         SELECT $1, * FROM unnest($2::text[], $3::text[])
         ON CONFLICT DO NOTHING`,
        [u.id, allCodes, statuses]
      );
    }

    console.log(
      `Criado: ${p.name} (apto ${p.apartment}) — ${missing.length} faltando, ${dups.length} repetidas`
    );
  }

  console.log('\nSeed concluido. Rode: npm start  e entre com qualquer email acima (ex.: ana@predio.com).');
  await pool.end();
}

run().catch((err) => {
  console.error('Erro no seed:', err);
  process.exit(1);
});
