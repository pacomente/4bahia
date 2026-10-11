// Configuración por variables de entorno.
export const config = {
  port: Number(process.env.PORT ?? 4000),
  dbPath: process.env.DB_PATH ?? 'data/taxi.db',
  brand: process.env.BRAND_NAME ?? 'Movi',
  city: process.env.CITY_NAME ?? 'Buenos Aires',
  center: { lat: Number(process.env.CITY_LAT ?? -34.6037), lng: Number(process.env.CITY_LNG ?? -58.3816) },
  demoPassword: process.env.DEMO_PASSWORD || 'demo1234',
  // Botones de "entrar como demo" en los logins.
  quickLogin: process.env.DEMO_QUICK_LOGIN !== 'false',
  // Ruteo por calles con OSRM (servidor público de demostración). Si falla, se usa un recorrido simulado.
  osrmUrl: process.env.OSRM_URL ?? 'https://router.project-osrm.org',
  routingEnabled: process.env.ROUTING !== 'off',
  simTickMs: Number(process.env.SIM_TICK_MS ?? 1000),
};
