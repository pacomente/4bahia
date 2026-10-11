import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { listRejected, clearRejected } from '../storage';
import { engine } from '../sync';
import { Button, Header, Notice } from '../components/ui';
import { STATUS, s } from '../theme';

// Acciones que el servidor no aceptó (ej. el paquete ya cambió de estado en la sucursal).
export default function RejectedScreen({ nav }) {
  const [items, setItems] = useState(listRejected());
  return (
    <View style={s.screen}>
      <Header title="Acciones rechazadas" onBack={nav.pop} />
      <FlatList
        data={items}
        keyExtractor={(x) => String(x.id)}
        contentContainerStyle={s.content}
        ListHeaderComponent={<Notice>Estas acciones no se registraron. Avisale a la sucursal para que lo resuelvan desde el panel.</Notice>}
        ListEmptyComponent={<Text style={s.muted}>No hay acciones rechazadas.</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.mono}>{item.payload.code}</Text>
            <Text style={s.text}>{STATUS[item.payload.status]?.[0] ?? item.payload.status}{item.payload.reason ? ` · ${item.payload.reason}` : ''}</Text>
            <Text style={s.small}>{new Date(item.payload.occurred_at).toLocaleString('es-AR')}</Text>
            <Text style={{ color: '#b22c2c' }}>{item.error}</Text>
          </View>
        )}
        ListFooterComponent={items.length ? <Button title="Ya avisé, borrar lista" variant="ghost" onPress={async () => { clearRejected(); setItems([]); engine.flush(); }} /> : null}
      />
    </View>
  );
}
