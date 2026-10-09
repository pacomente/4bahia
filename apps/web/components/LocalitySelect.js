'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

let cache = null;
export function useLocalities() {
  const [list, setList] = useState(cache ?? []);
  useEffect(() => {
    if (cache) return;
    api('/public/localities').then((l) => { cache = l; setList(l); }).catch(() => {});
  }, []);
  return list;
}

// Selector de localidad agrupado por provincia.
export default function LocalitySelect({ value, onChange, required, name }) {
  const list = useLocalities();
  const byProvince = list.reduce((acc, l) => ((acc[l.province] ??= []).push(l), acc), {});
  return (
    <select name={name} value={value ?? ''} required={required} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Elegí una localidad…</option>
      {Object.entries(byProvince).map(([prov, locs]) => (
        <optgroup key={prov} label={prov}>
          {locs.map((l) => <option key={l.id} value={l.id}>{l.name}{l.home_delivery ? '' : ' (solo retiro en sucursal)'}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
