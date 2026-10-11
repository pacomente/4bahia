import { Linking, ScrollView, Text, View } from 'react-native';
import { Badge, Button, Header, Notice } from '../components/ui';
import { colors, money, s } from '../theme';

export default function ShipmentScreen({ nav, params }) {
  const { trip, shipment: sh } = params;
  const delivery = trip.type === 'delivery';
  const canAct = trip.status === 'in_progress' && !sh.pendingSync;
  const canDeliver = canAct && delivery && sh.status === 'out_for_delivery';
  const navUrl = sh.navigation_url;

  return (
    <View style={s.screen}>
      <Header title={sh.tracking_code} subtitle={sh.recipient_name} onBack={nav.pop} />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.card}>
          <View style={s.between}><Text style={s.h2}>{sh.recipient_name}</Text><Badge status={sh.status} /></View>
          <Text style={s.text}>{sh.recipient_address ?? 'Retira en sucursal'}</Text>
          <Text style={s.muted}>{sh.destination}, {sh.destination_province}</Text>
          <Text style={s.muted}>{sh.packages_count} bulto{sh.packages_count > 1 ? 's' : ''}</Text>
          {sh.cod_amount_cents > 0 && (
            <View style={{ backgroundColor: colors.warnBg, borderRadius: 8, padding: 10, marginTop: 6 }}>
              <Text style={{ color: colors.warn, fontWeight: '700', fontSize: 16 }}>Cobrar al entregar: {money(sh.cod_amount_cents)}</Text>
            </View>
          )}
        </View>

        {sh.pendingSync && <Notice>Hay una acción de este paquete pendiente de enviar.</Notice>}

        <View style={s.row}>
          {navUrl && <Button title="Cómo llegar" variant="ghost" style={{ flex: 1 }} onPress={() => Linking.openURL(navUrl)} />}
          {sh.recipient_phone && <Button title="Llamar" variant="ghost" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${sh.recipient_phone.replace(/[^\d+]/g, '')}`)} />}
        </View>

        {trip.status !== 'in_progress' && <Notice tone="info">Iniciá el viaje para registrar entregas e incidencias.</Notice>}

        {canDeliver && (
          <>
            <Button title="Entregar" variant="accent" onPress={() => nav.push('Deliver', { shipment: sh })} />
            <Button title="Visita fallida" onPress={() => nav.push('Incident', { shipment: sh, status: 'failed_attempt' })} />
            <Button title="Rechazado por el destinatario" variant="ghost" onPress={() => nav.push('Incident', { shipment: sh, status: 'rejected' })} />
          </>
        )}
        {canAct && !['delivered', 'damaged'].includes(sh.status) && (
          <Button title="Informar paquete dañado" variant="ghost" onPress={() => nav.push('Incident', { shipment: sh, status: 'damaged' })} />
        )}
        {canAct && !['delivered', 'delayed'].includes(sh.status) && (
          <Button title="Informar demora" variant="ghost" onPress={() => nav.push('Incident', { shipment: sh, status: 'delayed' })} />
        )}
      </ScrollView>
    </View>
  );
}
