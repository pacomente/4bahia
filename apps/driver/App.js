import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { loadSession, clearSession } from './src/session';
import { clearCache } from './src/storage';
import { engine } from './src/sync';
import { stopTracking } from './src/location';
import LoginScreen from './src/screens/LoginScreen';
import TripsScreen from './src/screens/TripsScreen';
import TripScreen from './src/screens/TripScreen';
import ShipmentScreen from './src/screens/ShipmentScreen';
import DeliverScreen from './src/screens/DeliverScreen';
import IncidentScreen from './src/screens/IncidentScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import PhotoScreen from './src/screens/PhotoScreen';
import RejectedScreen from './src/screens/RejectedScreen';
import { colors } from './src/theme';

const SCREENS = {
  Trips: TripsScreen,
  Trip: TripScreen,
  Shipment: ShipmentScreen,
  Deliver: DeliverScreen,
  Incident: IncidentScreen,
  Scanner: ScannerScreen,
  Photo: PhotoScreen,
  Rejected: RejectedScreen,
};

let keySeq = 0;
const entry = (name, params = {}) => ({ key: ++keySeq, name, params });

export default function App() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [stack, setStack] = useState([entry('Trips')]);
  const focusListeners = useRef(new Map());

  useEffect(() => {
    loadSession().then((sess) => { setUser(sess.token ? sess.user : null); setReady(true); });
  }, []);

  // Sincroniza al volver a primer plano y cada minuto mientras la app está abierta.
  useEffect(() => {
    if (!user) return undefined;
    engine.flush();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') engine.flush(); });
    const id = setInterval(() => engine.flush(), 60_000);
    return () => { sub.remove(); clearInterval(id); };
  }, [user]);

  // Navegación mínima tipo "pila": todas las pantallas quedan montadas, se ve la de arriba.
  const top = stack[stack.length - 1];
  const prevTop = useRef(top.key);
  useEffect(() => {
    if (prevTop.current !== top.key) {
      prevTop.current = top.key;
      focusListeners.current.get(top.key)?.forEach((fn) => fn());
    }
  }, [top.key]);

  const makeNav = useCallback((key) => ({
    push: (name, params) => setStack((st) => [...st, entry(name, params)]),
    replace: (name, params) => setStack((st) => [...st.slice(0, -1), entry(name, params)]),
    pop: (n = 1) => setStack((st) => (st.length > 1 ? st.slice(0, Math.max(1, st.length - (typeof n === 'number' ? n : 1))) : st)),
    onFocus: (fn) => {
      const set = focusListeners.current.get(key) ?? new Set();
      set.add(fn);
      focusListeners.current.set(key, set);
      return () => set.delete(fn);
    },
  }), []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) { setStack((st) => st.slice(0, -1)); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack.length]);

  const logout = useCallback(async () => {
    await stopTracking();
    await clearSession();
    clearCache();
    setStack([entry('Trips')]);
    setUser(null);
  }, []);

  const navs = useMemo(() => new Map(), []);
  const navFor = (key) => {
    if (!navs.has(key)) navs.set(key, makeNav(key));
    return navs.get(key);
  };

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.brand }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style={user ? 'light' : 'dark'} />
      {!user ? (
        <LoginScreen onLogin={(u) => { setStack([entry('Trips')]); setUser(u); }} />
      ) : (
        stack.map((e, i) => {
          const Screen = SCREENS[e.name];
          const visible = i === stack.length - 1;
          return (
            <View key={e.key} style={{ flex: 1, display: visible ? 'flex' : 'none' }}>
              <Screen nav={navFor(e.key)} params={e.params} user={user} onLogout={logout} />
            </View>
          );
        })
      )}
    </SafeAreaProvider>
  );
}
