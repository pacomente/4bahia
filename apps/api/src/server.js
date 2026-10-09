import { openDb } from './db/index.js';
import { createApp } from './app.js';
import { config } from './config.js';
import { purgeOldPositions } from './lib/gps.js';
import { seed } from './db/seed.js';

const db = openDb();
if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  console.log('Base vacía: cargando datos de demostración…');
  seed(db);
}
purgeOldPositions(db);

createApp(db).listen(config.port, () => {
  console.log(`API 4 Bahía escuchando en http://localhost:${config.port}/api`);
});
