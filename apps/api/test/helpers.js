process.env.WEBHOOKS_ENABLED = 'false';
const { openDb } = await import('../src/db/index.js');
const { createApp } = await import('../src/app.js');
const { seed, DEMO_PASSWORD } = await import('../src/db/seed.js');

// Levanta la API sobre una base en memoria con los datos demo.
export async function startTestServer() {
  const db = openDb(':memory:');
  seed(db);
  const server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  async function call(method, path, { token, apiKey, body } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (apiKey) headers['x-api-key'] = apiKey;
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data = text;
    try { data = JSON.parse(text); } catch {}
    return { status: res.status, data };
  }
  async function login(email) {
    const r = await call('POST', '/auth/login', { body: { email, password: DEMO_PASSWORD } });
    if (r.status !== 200) throw new Error(`login ${email}: ${JSON.stringify(r.data)}`);
    return r.data.token;
  }
  const q = (sql, ...p) => db.prepare(sql).get(...p);
  return { db, base, call, login, q, close: () => server.close() };
}
