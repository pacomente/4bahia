import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { loadTrips } from '../trips';
import { engine } from '../sync';
import { isTracking } from '../location';
import { Badge, Header, Notice } from '../components/ui';
import SyncBar from '../components/SyncBar';
import { colors, s } from '../theme';

export default function TripsScreen({ nav, user, onLogout }) {
  const [trips, setTrips] = useState(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tracking, setTracking] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      await engine.flush();
      const r = await loadTrips();
      setTrips(r.data);
      setOffline(r.offline);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
      setTracking(await isTracking());
    }
  }, []);

  useEffect(() => { load(); return nav.onFocus(load); }, [load, nav]);

  const logout = () => Alert.alert('Cerrar sesión', '¿Querés salir? Las acciones pendientes se enviarán cuando vuelvas a ingresar.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Salir', style: 'destructive', onPress: onLogout },
  ]);

  return (
    <View style={s.screen}>
      <Header title="Mis viajes" subtitle={user.name} right={<Pressable onPress={logout} hitSlop={12}><Text style={{ color: '#fff' }}>Salir</Text></Pressable>} />
      <SyncBar onPressRejected={() => nav.push('Rejected')} />
      <FlatList
        data={trips ?? []}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListHeaderComponent={(
          <View style={{ gap: 12 }}>
            {offline && <Notice>Sin conexión: mostrando la última información guardada.</Notice>}
            {error && <Notice tone="bad">{error}</Notice>}
            {tracking && <Notice tone="info">Compartiendo ubicación del vehículo (viaje en curso).</Notice>}
          </View>
        )}
        ListEmptyComponent={trips && <Text style={[s.muted, { textAlign: 'center', marginTop: 40 }]}>No tenés viajes asignados.</Text>}
        renderItem={({ item: t }) => (
          <Pressable onPress={() => nav.push('Trip', { id: t.id })} style={({ pressed }) => [s.card, pressed && { opacity: 0.8 }]}>
            <View style={s.between}>
              <Text style={s.h2}>{t.type === 'transfer' ? 'Viaje troncal' : 'Reparto'}</Text>
              <Badge label={t.status === 'in_progress' ? 'En curso' : 'Planificado'} tone={t.status === 'in_progress' ? 'info' : 'neutral'} />
            </View>
            <Text style={s.text}>{t.type === 'transfer' ? `${t.origin_branch_name} → ${t.dest_branch_name}` : `Desde ${t.origin_branch_name}`}</Text>
            <Text style={s.small}>{t.code} · {t.plate} · {t.shipments_count} paquete{t.shipments_count === 1 ? '' : 's'}</Text>
          </Pressable>
        )}
      />
      <Text style={[s.small, { textAlign: 'center', paddingBottom: 12, color: colors.text2 }]}>Deslizá hacia abajo para actualizar</Text>
    </View>
  );
}
