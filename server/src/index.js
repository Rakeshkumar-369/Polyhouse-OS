// Polyhouse OS API server - entry point
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/super', require('./routes/superadmin'));
app.use('/api', require('./routes/settings'));
app.use('/api/ops', require('./routes/ops'));
app.use('/api/portal', require('./routes/portal'));
app.use('/api', require('./routes/reports'));
app.use('/api', require('./routes/crud'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app (client/dist) in production
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`Polyhouse OS API on http://localhost:${port}`));
