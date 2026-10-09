import { FilePlus2, Warehouse, Truck, Building2, PackageOpen, PackageCheck, Store, AlertTriangle } from 'lucide-react';

// Posición de cada estado en el recorrido principal.
const POS = { created: 0, received: 1, sorted: 1, in_transit: 2, at_destination_branch: 3, out_for_delivery: 4, ready_for_pickup: 4, delivered: 5 };
const ISSUES = ['delayed', 'damaged', 'failed_attempt', 'rejected', 'lost', 'returned', 'cancelled'];

/**
 * Barra de progreso del envío. history: lista de estados en orden (para ubicar
 * las incidencias en el último paso alcanzado).
 */
export default function ShipmentProgress({ status, deliveryType, history = [] }) {
  const steps = [
    ['Generado', FilePlus2],
    ['En sucursal', Warehouse],
    ['En viaje', Truck],
    ['En destino', Building2],
    deliveryType === 'home' ? ['En reparto', PackageOpen] : ['Para retirar', Store],
    ['Entregado', PackageCheck],
  ];
  const issue = ISSUES.includes(status);
  const reached = issue
    ? Math.max(0, ...history.map((s) => POS[s] ?? -1))
    : POS[status] ?? 0;
  return (
    <div className="stepper" style={{ '--steps': steps.length }} role="list" aria-label="Progreso del envío">
      {steps.map(([label, Icon], i) => {
        const done = i <= reached;
        const current = i === reached;
        const showIssue = current && issue;
        return (
          <div key={label} role="listitem" className={`step ${done ? 'done' : ''} ${current ? 'current' : ''} ${showIssue ? 'issue' : ''}`}
            aria-current={current ? 'step' : undefined}>
            <span className="dot">{showIssue ? <AlertTriangle size={16} /> : <Icon size={16} />}</span>
            <span className="lbl">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
