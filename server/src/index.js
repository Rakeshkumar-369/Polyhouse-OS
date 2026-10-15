// Polyhouse OS server - entry point. Prepares the database, then starts listening.
const env = require('./env');
const { ensureSchema } = require('./migrate');
const app = require('./app');
const { one } = require('./db');

(async () => {
  try {
    await ensureSchema();
    // SEED_DEMO=true -> load the demo farm once on an empty database (used by docker compose)
    if (String(process.env.SEED_DEMO).toLowerCase() === 'true' && !(await one('SELECT id FROM organizations LIMIT 1'))) {
      require('child_process').execFileSync(process.execPath, [require('path').join(__dirname, 'seed.js'), '--demo'], { stdio: 'inherit' });
    }
  } catch (e) {
    console.error('Database not reachable:', e.message);
    console.error('Check DB_HOST / DB_USER / DB_PASSWORD / DB_NAME (or DATABASE_URL) and DB_SSL in your environment.');
    process.exit(1);
  }
  app.listen(env.PORT, () => console.log(`Polyhouse OS running on http://localhost:${env.PORT}`));
})();
