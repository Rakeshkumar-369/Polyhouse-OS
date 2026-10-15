// Express app: security headers, gzip, API routes, and the built React app with long-term caching.
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
app.set('trust proxy', 1); // behind Render / Nginx / Caddy
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: { 'img-src': ["'self'", 'data:', 'blob:'], 'style-src': ["'self'", "'unsafe-inline'"], 'script-src': ["'self'"], 'upgrade-insecure-requests': null },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/public', require('./routes/public'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/super', require('./routes/superadmin'));
app.use('/api/portal', require('./routes/portal'));
app.use('/api/ops', require('./routes/ops'));
app.use('/api', require('./routes/settings'));
app.use('/api', require('./routes/reports'));
app.use('/api', require('./routes/crud'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Built web app (client/dist). Hashed files cached for a year; index.html never cached.
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '365d' }));
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(dist, 'index.html')); });
} else {
  app.get('/', (req, res) => res.send('API is running. Build the web app with: npm run build'));
}

module.exports = app;
