// Configuración por variables de entorno (valores por defecto aptos para desarrollo).
export const config = {
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? 'data/4bahia.db',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-cambiar-en-produccion',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3001',
  // Minutos sin posición GPS para considerar un vehículo desconectado.
  gpsOfflineMinutes: Number(process.env.GPS_OFFLINE_MINUTES ?? 10),
  // Días de retención del historial GPS (política de privacidad).
  gpsRetentionDays: Number(process.env.GPS_RETENTION_DAYS ?? 90),
  // Desactiva el envío real de webhooks (tests).
  webhooksEnabled: process.env.WEBHOOKS_ENABLED !== 'false',
};
