import { Router } from 'express';
import { requireRole, STAFF } from '../lib/auth.js';
import { pagination, oneOf } from '../lib/validate.js';
import { STATUS_LABELS, FINAL_STATUSES, INCIDENT_STATUSES } from '../lib/statuses.js';
import { computeAlerts } from './fleet.js';
import { sendCsv } from '../lib/csv.js';

export default function adminRoutes(db) {
  const r = Router();
  r.use(requireRole(...STAFF));

  // Panel de control: paquetes, entregas, facturación.
  r.get('/dashboard', (req, res) => {
    const from = req.query.from ?? new Date(Date.now() - 30 * 86400_000).toISOString();
    const branchFilter = req.user.role === 'superadmin' ? (req.query.branch_id ?? null) : req.user.branch_id;
    const bWhere = branchFilter ? ' AND (s.origin_branch_id = :b OR s.dest_branch_id = :b)' : '';
    const p = { from, b: branchFilter };
    const finals = FINAL_STATUSES.map((s) => `'${s}'`).join(',');
    const incidents = INCIDENT_STATUSES.map((s) => `'${s}'`).join(',');
    const one = (sql) => db.prepare(sql).get(branchFilter ? p : { from });

    const totals = one(`
      SELECT COUNT(*) AS shipments,
        SUM(CASE WHEN s.status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN s.status NOT IN (${finals}) THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN s.status IN (${incidents}) THEN 1 ELSE 0 END) AS incidents,
        COALESCE(SUM(s.price_cents), 0) AS billed_cents,
        COALESCE(SUM(s.cod_amount_cents), 0) AS cod_cents
      FROM shipments s WHERE s.created_at >= :from${bWhere}`);
    const onTime = one(`
      SELECT COUNT(*) AS n, SUM(CASE WHEN s.delivered_at <= s.estimated_delivery_at THEN 1 ELSE 0 END) AS on_time
      FROM shipments s WHERE s.status = 'delivered' AND s.created_at >= :from${bWhere}`);
    const byStatus = db.prepare(`SELECT s.status, COUNT(*) AS n FROM shipments s WHERE s.created_at >= :from${bWhere} GROUP BY s.status`)
      .all(branchFilter ? p : { from }).map((x) => ({ ...x, label: STATUS_LABELS[x.status] }));
    const daily = db.prepare(`
      SELECT substr(s.created_at, 1, 10) AS day, COUNT(*) AS shipments, SUM(s.price_cents) AS billed_cents
      FROM shipments s WHERE s.created_at >= :from${bWhere} GROUP BY day ORDER BY day`).all(branchFilter ? p : { from });
    const byBranch = db.prepare(`
      SELECT b.code, b.name, COUNT(s.id) AS shipments, COALESCE(SUM(s.price_cents), 0) AS billed_cents
      FROM branches b LEFT JOIN shipments s ON s.origin_branch_id = b.id AND s.created_at >= :from
      GROUP BY b.id ORDER BY shipments DESC`).all({ from });
    const fleet = db.prepare(`
      SELECT COUNT(*) AS vehicles,
        (SELECT COUNT(*) FROM trips WHERE status = 'in_progress') AS trips_in_progress
      FROM vehicles WHERE active = 1`).get();

    res.json({
      from,
      branch_id: branchFilter,
      totals: { ...totals, on_time_pct: onTime.n ? Math.round((onTime.on_time / onTime.n) * 100) : null },
      by_status: byStatus,
      daily,
      by_branch: byBranch,
      fleet,
      alerts: computeAlerts(db),
      open_requests: db.prepare("SELECT COUNT(*) AS n FROM contact_requests WHERE status != 'closed'").get().n,
    });
  });

  r.get('/audit', requireRole('superadmin'), (req, res) => {
    const { limit, offset } = pagination(req.query);
    const where = [];
    const params = [];
    if (req.query.entity) { where.push('a.entity = ?'); params.push(req.query.entity); }
    if (req.query.entity_id) { where.push('a.entity_id = ?'); params.push(req.query.entity_id); }
    if (req.query.user_id) { where.push('a.user_id = ?'); params.push(req.query.user_id); }
    const rows = db.prepare(`
      SELECT a.*, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.id DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    if (req.query.format === 'csv') return sendCsv(res, 'auditoria.csv', rows, ['created_at', 'user_name', 'action', 'entity', 'entity_id', 'ip', 'data']);
    res.json(rows.map((a) => ({ ...a, data: a.data ? JSON.parse(a.data) : null })));
  });

  // Contacto y reclamos de la web pública.
  r.get('/requests', (req, res) => {
    res.json(db.prepare(`SELECT * FROM contact_requests ${req.query.status ? 'WHERE status = ?' : ''} ORDER BY id DESC LIMIT 200`)
      .all(...(req.query.status ? [req.query.status] : [])));
  });
  r.patch('/requests/:id', (req, res) => {
    oneOf(req.body.status, 'status', ['open', 'in_progress', 'closed']);
    db.prepare('UPDATE contact_requests SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
    res.json(db.prepare('SELECT * FROM contact_requests WHERE id = ?').get(req.params.id));
  });

  r.get('/notifications', (_req, res) => res.json(db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 200').all()));

  return r;
}
