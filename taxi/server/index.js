import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb } from './db.js';
import { config } from './config.js';
import { seed } from './seed.js';
import { createEngine } from './engine.js';
import { authenticate, errorHandler, notFound } from './auth.js';
import publicRoutes, { publicUser } from './routes/public.js';
import riderRoutes from './routes/rider.js';
import driverRoutes from './routes/driver.js';
import adminRoutes from './routes/admin.js';

export function createServer({ dbPath = config.dbPath, loop = true } = {}) {
  const db = openDb(dbPath);
  if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) seed(db);
  const engine = createEngine(db);
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));
  const auth = authenticate(db);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/public', publicRoutes(db, engine));
  app.get('/api/me', auth, (req, res) => res.json(publicUser(req.user)));
  app.use('/api/rider', auth, riderRoutes(db, engine));
  app.use('/api/driver', auth, driverRoutes(db, engine));
  app.use('/api/admin', auth, adminRoutes(db, engine));
  app.use('/api', (_req, _res, next) => next(notFound('Ruta inexistente')));

  // Frontend compilado (Vite) — una sola app con /pasajero, /conductor y /admin.
  const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
  }
  app.use(errorHandler);
  if (loop) engine.startLoop();
  return { app, db, engine };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { app } = createServer();
  app.listen(config.port, () => console.log(`${config.brand} demo en http://localhost:${config.port}`));
}
