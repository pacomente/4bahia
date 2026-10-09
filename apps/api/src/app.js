import express from 'express';
import { authenticate as authMiddleware } from './lib/auth.js';
import { errorHandler, notFound } from './lib/errors.js';
import authRoutes from './modules/auth.js';
import userRoutes from './modules/users.js';
import catalogRoutes, { publicCatalogRoutes } from './modules/catalog.js';
import publicRoutes from './modules/public.js';
import shipmentRoutes from './modules/shipments.js';
import branchOpsRoutes from './modules/branchOps.js';
import fleetRoutes from './modules/fleet.js';
import driverRoutes from './modules/driver.js';
import adminRoutes from './modules/admin.js';
import financeRoutes from './modules/finance.js';
import { integrationAdminRoutes, externalApiRoutes } from './modules/integrations.js';

export function createApp(db) {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '5mb' })); // firmas/fotos en base64 desde la app

  // CORS abierto para el prototipo (web, panel y app en otros orígenes).
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  const authenticate = authMiddleware(db);

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: '4bahia-api', time: new Date().toISOString() }));

  // Públicas
  app.use('/api/auth', authRoutes(db, { authenticate }));
  app.use('/api/public', publicRoutes(db));
  app.use('/api/public', publicCatalogRoutes(db));

  // Autenticadas
  app.use('/api/users', authenticate, userRoutes(db));
  app.use('/api/catalog', authenticate, catalogRoutes(db));
  app.use('/api/shipments', authenticate, shipmentRoutes(db));
  app.use('/api/branches/:branchId/ops', authenticate, branchOpsRoutes(db));
  app.use('/api/fleet', authenticate, fleetRoutes(db));
  app.use('/api/driver', authenticate, driverRoutes(db));
  app.use('/api/admin', authenticate, adminRoutes(db));
  app.use('/api/finance', authenticate, financeRoutes(db));
  app.use('/api/integrations', authenticate, integrationAdminRoutes(db));
  app.use('/api/v1', authenticate, externalApiRoutes(db));

  app.use((_req, _res, next) => next(notFound('Ruta inexistente')));
  app.use(errorHandler);
  return app;
}
