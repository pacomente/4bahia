import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { recordEvent } from '../sync';
import { currentCoords } from '../location';
import { loadFailedReasons } from '../trips';
import { Button, Field, Header } from '../components/ui';
import { colors, s } from '../theme';

const CONFIG = {
  failed_attempt: { title: 'Visita fallida', reasons: null },
  rejected: { title: 'Rechazado', reasons: ['Rechazado por destinatario', 'Mercadería dañada', 'No es lo que pidió', 'Otro'] },
  damaged: { title: 'Paquete dañado', reasons: ['Embalaje roto', 'Mercadería golpeada', 'Humedad', 'Otro'] },
  delayed: { title: 'Demora', reasons: ['Tránsito / corte de ruta', 'Falla mecánica', 'Condiciones climáticas', 'Demora en carga', 'Otro'] },
};

export default function IncidentScreen({ nav, params }) {
  const { shipment: sh, status } = params;
  const cfg = CONFIG[status];
  const [reasons, setReasons] = useState(cfg.reasons ?? []);
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!cfg.reasons) loadFailedReasons().then(setReasons); }, [cfg.reasons]);

  async function confirm() {
    setBusy(true);
    const coords = await currentCoords();
    recordEvent({ code: sh.tracking_code, status, reason, note: note.trim() || undefined, coords });
    nav.pop(2);
  }

  return (
    <View style={s.screen}>
      <Header title={cfg.title} subtitle={sh.tracking_code} onBack={nav.pop} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.h2}>Motivo</Text>
        {reasons.map((r) => (
          <Pressable key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ selected: reason === r }}
            style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: reason === r ? colors.accent : colors.border, borderWidth: reason === r ? 2 : 1 }]}>
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: reason === r ? colors.accent : colors.text2, alignItems: 'center', justifyContent: 'center' }}>
              {reason === r && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} />}
            </View>
            <Text style={s.text}>{r}</Text>
          </Pressable>
        ))}
        <Field label="Comentario (opcional)" value={note} onChangeText={setNote} multiline />
        <Button title="Confirmar" variant="accent" disabled={!reason} busy={busy} onPress={confirm} />
      </ScrollView>
    </View>
  );
}
