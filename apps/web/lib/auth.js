'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken, setToken } from './api';

const AuthContext = createContext(null);

export const HOME_BY_ROLE = {
  superadmin: '/admin',
  branch_admin: '/sucursal',
  operator: '/sucursal',
  driver: '/chofer',
  customer: '/cliente',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api('/auth/me').then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (data) => {
    const { token, user } = await api('/auth/register', { method: 'POST', body: data });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(() => { setToken(null); setUser(null); }, []);

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// Protege un área por rol; redirige al login o a la home del rol.
export function useRequireRole(roles) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = !!user && roles.includes(user.role);
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/ingresar');
    else if (!roles.includes(user.role)) router.replace(HOME_BY_ROLE[user.role] ?? '/');
  }, [loading, user, router, roles]);
  return { user, ready: !loading && allowed };
}
