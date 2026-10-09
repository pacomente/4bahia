import { Router } from 'express';
import { requireRole, STAFF } from '../lib/auth.js';
import { forbidden, notFound } from '../lib/errors.js';
import { required, positiveNumber } from '../lib/validate.js';
import { audit } from '../lib/audit.js';
import { sendCsv } from '../lib/csv.js';
import { nowIso } from '../db/index.js';

export default function financeRoutes(db) {
  const r = Router();

  // Cuenta corriente: el cliente ve la suya, staff ve cualquiera.
  r.get('/accounts/:customerId', (req, res) => {
    const cid = Number(req.params.customerId);
    if (!STAFF.includes(req.user.role) && req.user.customer_id !== cid) throw forbidden();
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(cid);
    if (!customer) throw notFound('Cliente no encontrado');
    const entries = db.prepare(`
      SELECT l.*, s.tracking_code FROM ledger_entries l LEFT JOIN shipments s ON s.id = l.shipment_id
      WHERE l.customer_id = ? ORDER BY l.id DESC LIMIT 500`).all(cid);
    const balance = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN type = 'payment' THEN -amount_cents ELSE amount_cents END), 0) AS b
      FROM ledger_entries WHERE customer_id = ?`).get(cid).b;
    res.json({ customer, balance_cents: balance, entries });
  });

  r.use(requireRole(...STAFF));

  r.get('/accounts', (_req, res) => {
    res.json(db.prepare(`
      SELECT c.id, c.name, c.tax_id, c.type, c.credit_limit_cents,
        COALESCE(SUM(CASE WHEN l.type = 'payment' THEN -l.amount_cents ELSE l.amount_cents END), 0) AS balance_cents
      FROM customers c LEFT JOIN ledger_entries l ON l.customer_id = c.id
      WHERE c.type = 'commercial' GROUP BY c.id ORDER BY balance_cents DESC`).all());
  });

  // Registro de cobro (pago de cliente o cobro de un envío en mostrador).
  r.post('/payments', (req, res) => {
    required(req.body, ['amount']);
    const cents = Math.round(positiveNumber(req.body.amount, 'amount') * 100);
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO ledger_entries (customer_id, shipment_id, branch_id, type, amount_cents, method, note, user_id)
      VALUES (?, ?, ?, 'payment', ?, ?, ?, ?)`).run(req.body.customer_id ?? null, req.body.shipment_id ?? null,
      req.body.branch_id ?? req.user.branch_id ?? null, cents, req.body.method ?? 'efectivo', req.body.note ?? null, req.user.id);
    audit(db, req, 'payment.create', 'ledger_entry', Number(lastInsertRowid), { cents, customer_id: req.body.customer_id });
    res.status(201).json(db.prepare('SELECT * FROM ledger_entries WHERE id = ?').get(lastInsertRowid));
  });

  // Contrarreembolsos: pendientes de cobro, cobrados pendientes de rendir, rendidos.
  r.get('/cod', (req, res) => {
    res.json(db.prepare(`
      SELECT c.*, s.tracking_code, s.customer_id, cu.name AS customer_name, u.name AS collected_by_name
      FROM cod_collections c JOIN shipments s ON s.id = c.shipment_id LEFT JOIN customers cu ON cu.id = s.customer_id
      LEFT JOIN users u ON u.id = c.collected_by
      ${req.query.status ? 'WHERE c.status = ?' : ''} ORDER BY c.id DESC LIMIT 1000`).all(...(req.query.status ? [req.query.status] : [])));
  });

  // Liquidación: marca como rendidos los contrarreembolsos cobrados de un cliente.
  r.post('/cod/settle', requireRole('superadmin', 'branch_admin'), (req, res) => {
    required(req.body, ['customer_id']);
    const ids = db.prepare(`
      SELECT c.id, c.amount_cents FROM cod_collections c JOIN shipments s ON s.id = c.shipment_id
      WHERE c.status = 'collected' AND s.customer_id = ?`).all(req.body.customer_id);
    const now = nowIso();
    for (const c of ids) db.prepare("UPDATE cod_collections SET status = 'settled', settled_at = ? WHERE id = ?").run(now, c.id);
    const total = ids.reduce((a, c) => a + c.amount_cents, 0);
    audit(db, req, 'cod.settle', 'customer', Number(req.body.customer_id), { count: ids.length, total });
    res.json({ settled: ids.length, total_cents: total });
  });

  // Informe de ingresos por día y sucursal (CSV para contabilidad).
  r.get('/reports/revenue', (req, res) => {
    const from = req.query.from ?? new Date(Date.now() - 30 * 86400_000).toISOString();
    const to = req.query.to ?? nowIso();
    const rows = db.prepare(`
      SELECT substr(l.created_at, 1, 10) AS day, b.code AS branch,
        SUM(CASE WHEN l.type = 'charge' THEN l.amount_cents ELSE 0 END) / 100.0 AS charged,
        SUM(CASE WHEN l.type = 'payment' THEN l.amount_cents ELSE 0 END) / 100.0 AS collected
      FROM ledger_entries l LEFT JOIN branches b ON b.id = l.branch_id
      WHERE l.created_at BETWEEN ? AND ? GROUP BY day, branch ORDER BY day, branch`).all(from, to);
    if (req.query.format === 'csv') return sendCsv(res, 'ingresos.csv', rows, ['day', 'branch', 'charged', 'collected']);
    res.json({ from, to, rows });
  });

  return r;
}
