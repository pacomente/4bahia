import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { engine, onSyncChange } from '../sync';
import { colors } from '../theme';

// Muestra cuántas acciones faltan enviar y permite forzar la sincronización.
export default function SyncBar({ onPressRejected }) {
  const [st, setSt] = useState(null);
  useEffect(() => {
    engine.status().then(setSt);
    return onSyncChange(setSt);
  }, []);
  if (!st) return null;
  const pending = st.pendingEvents;
  const offline = !!st.lastError;
  const tone = st.rejected ? colors.bad : pending || offline ? colors.warn : colors.good;
  const bg = st.rejected ? colors.badBg : pending || offline ? colors.warnBg : colors.goodBg;
  let text = 'Todo sincronizado';
  if (pending) text = `${pending} acción${pending > 1 ? 'es' : ''} pendiente${pending > 1 ? 's' : ''} de enviar`;
  else if (offline) text = 'Sin conexión: se envía al volver la señal';
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ color: tone, fontSize: 13, flex: 1 }}>
        {text}{st.lastSyncAt ? ` · último envío ${new Date(st.lastSyncAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : ''}
      </Text>
      {st.rejected > 0 && (
        <Pressable onPress={onPressRejected} hitSlop={10}><Text style={{ color: colors.bad, fontWeight: '700', fontSize: 13 }}>{st.rejected} rechazada{st.rejected > 1 ? 's' : ''}</Text></Pressable>
      )}
      <Pressable onPress={() => engine.flush()} hitSlop={10}><Text style={{ color: colors.info, fontWeight: '700', fontSize: 13 }}>Sincronizar</Text></Pressable>
    </View>
  );
}
