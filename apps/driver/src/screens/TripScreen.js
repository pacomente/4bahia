import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, Text, View } from 'react-native';
import { loadTrip, loadTrips, startTrip, finishTrip } from '../trips';
import { startTracking, stopTracking } from '../location';
import { Badge, Button, Header, Notice } from '../components/ui';
import SyncBar from '../components/SyncBar';
import { colors, money, s } from '../theme';

export default function TripScreen({ nav, params }) {
  const [trip, setTrip] = useState(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await loadTrip(params.id);
      setTrip(r.data);
      setOffline(r.offline);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, [params.id]);

  useEffect(() => { load(); return nav.onFocus(load); }, [load, nav]);

  async function start() {
    setBusy(true);
    try {
      await startTrip(trip.id);
      const gps = await startTracking();
      if (!gps.ok) Alert.alert('Ubicación', gps.message);
      else if (!gps.background) Alert.alert('Ubicación', 'Para informar la posición con la app cerrada, permití la ubicación "Todo el tiempo" en la configuración del teléfono.');
      await load();
    } catch (e) {
      Alert.alert('No se pudo iniciar el viaje', e.status === 0 ? 'Necesitás conexión para iniciar el viaje.' : e.message);
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    const open = trip.shipments.filter((x) => ['out_for_delivery', 'in_transit'].includes(x.status)).length;
    Alert.alert('Finalizar viaje', open && trip.type === 'delivery'
      ? `Quedan ${open} paquetes sin entregar ni marcar como visita fallida. Al volver, entregalos en la sucursal para que los escaneen.`
      : '¿Confirmás que terminaste el viaje?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Finalizar', onPress: async () => {
        setBusy(true);
        try {
          await finishTrip(trip.id);
          const remaining = (await loadTrips()).data.filter((t) => t.status === 'in_progress');
          if (!remaining.length) await stopTracking();
          nav.pop();
        } catch (e) {
          Alert.alert('No se pudo finalizar', e.status === 0 ? 'Necesitás conexión para finalizar el viaje.' : e.message);
        } finally {
          setBusy(false);
        }
      } },
    ]);
  }

  function onScanned(code) {
    const sh = trip.shipments.find((x) => x.tracking_code === code);
    if (sh) nav.replace('Shipment', { trip, shipment: sh });
    else { nav.pop(); Alert.alert('Código no encontrado', `${code} no pertenece a este viaje.`); }
  }

  if (!trip) {
    return (
      <View style={s.screen}>
        <Header title="Viaje" onBack={nav.pop} />
        <View style={s.content}>{error ? <Notice tone="bad">{error}</Notice> : <Text style={s.muted}>Cargando…</Text>}</View>
      </View>
    );
  }

  const inProgress = trip.status === 'in_progress';
  const done = trip.shipments.filter((x) => ['delivered', 'failed_attempt', 'rejected'].includes(x.status)).length;
  const destNav = trip.type === 'transfer' && trip.dest_lat != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${trip.dest_lat},${trip.dest_lng}` : null;

  return (
    <View style={s.screen}>
      <Header title={trip.type === 'transfer' ? 'Viaje troncal' : 'Reparto'} subtitle={`${trip.code} · ${trip.plate}`} onBack={nav.pop} />
      <SyncBar onPressRejected={() => nav.push('Rejected')} />
      <FlatList
        data={trip.shipments}
        keyExtractor={(x) => String(x.id)}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListHeaderComponent={(
          <View style={{ gap: 12 }}>
            {offline && <Notice>Sin conexión: mostrando la última información guardada.</Notice>}
            <View style={s.card}>
              <Text style={s.text}>
                {trip.type === 'transfer' ? `${trip.origin_branch_name} → ${trip.dest_branch_name}` : `Reparto desde ${trip.origin_branch_name}`}
              </Text>
              {trip.type === 'delivery' && <Text style={s.small}>{done} de {trip.shipments.length} resueltos</Text>}
              {trip.type === 'transfer' && <Text style={s.small}>Al llegar, la sucursal destino escanea los paquetes para confirmar la recepción.</Text>}
              {destNav && <Button title="Navegar a la sucursal destino" variant="ghost" onPress={() => Linking.openURL(destNav)} style={{ marginTop: 6 }} />}
            </View>
            {!inProgress && <Button title="Iniciar viaje" variant="accent" onPress={start} busy={busy} />}
            {inProgress && (
              <View style={s.row}>
                <Button title="Escanear paquete" style={{ flex: 1 }} onPress={() => nav.push('Scanner', { onScanned })} />
                <Button title="Finalizar" variant="ghost" style={{ flex: 1 }} onPress={finish} busy={busy} />
              </View>
            )}
            <Text style={[s.h2, { marginTop: 4 }]}>Paquetes</Text>
          </View>
        )}
        renderItem={({ item: sh }) => (
          <Pressable onPress={() => nav.push('Shipment', { trip, shipment: sh })} style={({ pressed }) => [s.card, pressed && { opacity: 0.8 }]}>
            <View style={s.between}>
              <Text style={s.mono}>{sh.stop_order}. {sh.tracking_code}</Text>
              <Badge status={sh.status} />
            </View>
            <Text style={s.text}>{sh.recipient_name}</Text>
            <Text style={s.small}>{sh.recipient_address ? `${sh.recipient_address}, ` : ''}{sh.destination}</Text>
            <View style={s.row}>
              <Text style={s.small}>{sh.packages_count} bulto{sh.packages_count > 1 ? 's' : ''}</Text>
              {sh.cod_amount_cents > 0 && <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Cobrar {money(sh.cod_amount_cents)}</Text>}
              {sh.pendingSync && <Text style={{ color: colors.warn, fontSize: 13 }}>· pendiente de enviar</Text>}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
