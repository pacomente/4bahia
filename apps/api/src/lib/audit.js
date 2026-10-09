export function audit(db, req, action, entity, entityId, data) {
  db.prepare(
    'INSERT INTO audit_logs (user_id, action, entity, entity_id, data, ip) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(req?.user?.id ?? null, action, entity ?? null, entityId ?? null, data ? JSON.stringify(data) : null, req?.ip ?? null);
}
