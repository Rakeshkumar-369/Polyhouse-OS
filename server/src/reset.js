// DANGER: drops every table and loads fresh demo data.   npm run db:reset   (add --no-seed for an empty database)
require('./env');
const { pool, q, DB_NAME } = require('./db');
const { ensureSchema } = require('./migrate');

(async () => {
  const tables = await q('SELECT TABLE_NAME t FROM information_schema.TABLES WHERE TABLE_SCHEMA=?', [DB_NAME]);
  for (const { t } of tables) await q(`DROP TABLE IF EXISTS \`${t}\``);
  console.log(`Dropped ${tables.length} tables`);
  await ensureSchema();
  await pool.end();
  if (!process.argv.includes('--no-seed')) require('child_process').execFileSync(process.execPath, [require('path').join(__dirname, 'seed.js'), '--demo'], { stdio: 'inherit' });
})().catch((e) => { console.error(e); process.exit(1); });
