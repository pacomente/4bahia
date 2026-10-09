'use client';
import { useEffect, useState } from 'react';
import { PageHead } from '@/components/AppShell';
import CrudTable from '@/components/CrudTable';
import { api } from '@/lib/api';
import { Field, ErrorBox, useApi, useSubmit } from '@/components/ui';

const SETTINGS = [
  ['volumetric_divisor', 'Divisor peso volumétrico (cm³/kg)', 1],
  ['home_delivery_cents', 'Recargo entrega a domicilio ($)', 100],
  ['extra_package_cents', 'Por bulto adicional ($)', 100],
  ['insurance_pct', 'Seguro (% del valor declarado)', 1],
  ['insurance_min_cents', 'Seguro mínimo ($)', 100],
  ['cod_fee_pct', 'Comisión contrarreembolso (%)', 1],
  ['cod_fee_min_cents', 'Comisión contrarreembolso mínima ($)', 100],
  ['fuel_surcharge_pct', 'Recargo combustible (%)', 1],
  ['tax_pct', 'IVA (%)', 1],
];

export default function Tarifas() {
  const [tab, setTab] = useState('tariffs');
  const { data: zones } = useApi('/catalog/zones');
  const zoneOpts = zones?.map((z) => ({ value: z.id, label: `${z.code} · ${z.name}` })) ?? [];
  return (
    <>
      <PageHead title="Tarifas y servicios" sub="Lo que usa el cotizador para calcular cada precio" />
      <div className="tabs">
        {[['tariffs', 'Tarifas por zona'], ['settings', 'Parámetros del cotizador'], ['services', 'Servicios'], ['zones', 'Zonas']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'tariffs' && (
        <div className="stack">
          <p className="small muted" style={{ margin: 0 }}>Cada fila es un tramo de peso para un par de zonas origen → destino. Sobre el último tramo se cobra el $/kg adicional.</p>
          {zones && <CrudTable endpoint="/catalog/tariffs" columns={[
            { key: 'origin_zone_id', label: 'Zona origen', type: 'select', options: zoneOpts },
            { key: 'dest_zone_id', label: 'Zona destino', type: 'select', options: zoneOpts },
            { key: 'max_weight_g', label: 'Hasta (g)', type: 'number' },
            { key: 'price_cents', label: 'Precio', type: 'money' },
            { key: 'extra_kg_cents', label: '$/kg adicional', type: 'money' },
          ]} />}
        </div>
      )}
      {tab === 'settings' && <Settings />}
      {tab === 'services' && <CrudTable endpoint="/catalog/services" columns={[
        { key: 'code', label: 'Código' }, { key: 'name', label: 'Nombre' },
        { key: 'transit_days', label: 'Días de tránsito', type: 'number' },
        { key: 'price_multiplier', label: 'Multiplicador de precio', type: 'number' },
        { key: 'active', label: 'Activo', type: 'bool' },
      ]} defaults={{ active: true, price_multiplier: 1, transit_days: 2 }} />}
      {tab === 'zones' && <CrudTable endpoint="/catalog/zones" columns={[{ key: 'code', label: 'Código' }, { key: 'name', label: 'Nombre' }]} />}
    </>
  );
}

function Settings() {
  const { data } = useApi('/catalog/pricing-settings');
  const [f, setF] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (data) setF(Object.fromEntries(SETTINGS.map(([k, , div]) => [k, data[k] / div])));
  }, [data]);
  const { run, busy, error } = useSubmit(async () => {
    await api('/catalog/pricing-settings', { method: 'PUT', body: Object.fromEntries(SETTINGS.map(([k, , div]) => [k, Math.round(Number(f[k]) * div * 100) / 100])) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  });
  if (!f) return null;
  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); run(); }}>
      <div className="form-grid">
        {SETTINGS.map(([k, label]) => (
          <Field key={k} label={label}><input type="number" step="any" value={f[k]} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} /></Field>
        ))}
      </div>
      <ErrorBox error={error} />
      {saved && <div className="alert ok">Parámetros guardados.</div>}
      <div><button className="btn" disabled={busy}>Guardar</button></div>
    </form>
  );
}
