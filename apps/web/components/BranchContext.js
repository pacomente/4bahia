'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useApi } from './ui';

const BranchContext = createContext(null);
const KEY = '4bahia_branch';

// Sucursal activa: la del usuario, o la elegida por el superadmin.
export function BranchProvider({ children }) {
  const { user } = useAuth();
  const { data: branches } = useApi('/public/branches');
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!user) return;
    if (user.branch_id) { setSelected(user.branch_id); return; }
    let saved = null;
    try { saved = Number(localStorage.getItem(KEY)) || null; } catch {}
    setSelected(saved);
  }, [user]);
  useEffect(() => {
    if (!selected && branches?.length && user && !user.branch_id) setSelected(branches[0].id);
  }, [branches, selected, user]);
  const choose = (id) => { setSelected(id); try { localStorage.setItem(KEY, String(id)); } catch {} };
  const branch = branches?.find((b) => b.id === selected) ?? null;
  return (
    <BranchContext.Provider value={{ branchId: selected, branch, branches, choose, canChoose: !user?.branch_id }}>
      {children}
    </BranchContext.Provider>
  );
}

export const useBranch = () => useContext(BranchContext);

export function BranchPicker() {
  const { branchId, branches, choose, canChoose, branch } = useBranch();
  if (!canChoose) return <span className="badge info">{branch ? `${branch.code} · ${branch.name}` : '…'}</span>;
  return (
    <select style={{ width: 'auto' }} value={branchId ?? ''} onChange={(e) => choose(Number(e.target.value))} aria-label="Sucursal">
      {branches?.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
    </select>
  );
}
