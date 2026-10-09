'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, Loading, useApi } from './ui';

/**
 * Tabla editable sobre un recurso del catálogo.
 * columns: [{ key, label, type: 'text'|'number'|'bool'|'select'|'money', options?: [{value,label}], required?, readOnly? }]
 * 'money' muestra/edita en pesos y guarda en centavos.
 */
export default function CrudTable({ endpoint, columns, canEdit = true, defaults = {} }) {
  const { data, error, loading, reload } = useApi(endpoint);
  const [editing, setEditing] = useState(null);   // id o 'new'
  const [draft, setDraft] = useState({});
  const [saveError, setSaveError] = useState(null);

  const start = (row) => {
    setEditing(row?.id ?? 'new');
    setDraft(row ? Object.fromEntries(columns.map((c) => [c.key, toInput(c, row[c.key])])) : { ...defaults });
    setSaveError(null);
  };

  async function save() {
    const body = {};
    for (const c of columns) {
      if (c.readOnly) continue;
      const v = draft[c.key];
      if (v === undefined || v === '') continue;
      body[c.key] = fromInput(c, v);
    }
    try {
      if (editing === 'new') await api(endpoint, { method: 'POST', body });
      else await api(`${endpoint}/${editing}`, { method: 'PATCH', body });
      setEditing(null);
      reload();
    } catch (e) {
      setSaveError(e);
    }
  }

  if (loading && !data) return <Loading />;
  const editRow = (
    <>
      {columns.map((c) => (
        <td key={c.key}>{c.readOnly && editing !== 'new' ? display(c, draft[c.key]) : <Input col={c} value={draft[c.key]} onChange={(v) => setDraft((d) => ({ ...d, [c.key]: v }))} />}</td>
      ))}
      <td className="nowrap">
        <button className="btn sm" onClick={save}>Guardar</button>{' '}
        <button className="btn ghost sm" onClick={() => setEditing(null)}>Cancelar</button>
      </td>
    </>
  );

  return (
    <div className="stack">
      <ErrorBox error={error ?? saveError} />
      <div className="table-wrap">
        <table>
          <thead><tr>{columns.map((c) => <th key={c.key} className={c.type === 'number' || c.type === 'money' ? 'num' : ''}>{c.label}</th>)}{canEdit && <th />}</tr></thead>
          <tbody>
            {data?.map((row) => (
              <tr key={row.id}>
                {editing === row.id ? editRow : (
                  <>
                    {columns.map((c) => <td key={c.key} className={c.type === 'number' || c.type === 'money' ? 'num' : ''}>{display(c, row[c.key])}</td>)}
                    {canEdit && <td><button className="btn ghost sm" onClick={() => start(row)}>Editar</button></td>}
                  </>
                )}
              </tr>
            ))}
            {editing === 'new' && <tr>{editRow}</tr>}
          </tbody>
        </table>
      </div>
      {canEdit && editing !== 'new' && <div><button className="btn ghost" onClick={() => start(null)}>+ Agregar</button></div>}
    </div>
  );
}

function Input({ col, value, onChange }) {
  if (col.type === 'bool') return <input type="checkbox" style={{ width: 'auto' }} checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
  if (col.type === 'select') {
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {col.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  return <input type={col.type === 'number' || col.type === 'money' ? 'number' : 'text'} step="any" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
}

const toInput = (c, v) => (c.type === 'money' && v != null ? v / 100 : c.type === 'bool' ? !!v : v ?? '');
function fromInput(c, v) {
  if (c.type === 'money') return Math.round(Number(v) * 100);
  if (c.type === 'number') return Number(v);
  if (c.type === 'bool') return v ? 1 : 0;
  if (c.type === 'select') return /^\d+$/.test(String(v)) ? Number(v) : v;
  return v;
}
function display(c, v) {
  if (c.type === 'bool') return v ? 'Sí' : 'No';
  if (c.type === 'money') return v == null ? '—' : (v / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  if (c.type === 'select') return c.options?.find((o) => String(o.value) === String(v))?.label ?? (v ?? '—');
  return v ?? '—';
}
