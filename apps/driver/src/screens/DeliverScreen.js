import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { recordEvent } from '../sync';
import { currentCoords } from '../location';
import SignaturePad from '../components/SignaturePad';
import { Button, Field, Header, Notice } from '../components/ui';
import { colors, money, s } from '../theme';

export default function DeliverScreen({ nav, params }) {
  const sh = params.shipment;
  const [name, setName] = useState(sh.recipient_name ?? '');
  const [doc, setDoc] = useState('');
  const [signature, setSignature] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [codOk, setCodOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const cod = sh.cod_amount_cents > 0;
  const ready = name.trim() && doc.trim() && (signature || photo) && (!cod || codOk);

  async function confirm() {
    setBusy(true);
    const coords = await currentCoords();
    recordEvent({
      code: sh.tracking_code,
      status: 'delivered',
      note: cod ? `Cobrado contrarreembolso ${money(sh.cod_amount_cents)}` : undefined,
      proof: { receiver_name: name.trim(), receiver_doc: doc.trim(), signature_data: signature ?? undefined, photo_data: photo ?? undefined },
      coords,
    });
    nav.pop(2);
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Entregar" subtitle={sh.tracking_code} onBack={nav.pop} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={[s.card, { gap: 12 }]}>
          <Field label="Recibe (nombre y apellido)" value={name} onChangeText={setName} />
          <Field label="DNI de quien recibe" value={doc} onChangeText={setDoc} keyboardType="number-pad" />
        </View>
        {cod && (
          <View style={[s.card, s.between]}>
            <Text style={[s.text, { flex: 1, color: colors.warn, fontWeight: '700' }]}>Cobré {money(sh.cod_amount_cents)} de contrarreembolso</Text>
            <Switch value={codOk} onValueChange={setCodOk} />
          </View>
        )}
        <View style={s.card}>
          <Text style={s.h2}>Firma</Text>
          <SignaturePad onChange={setSignature} />
        </View>
        <View style={s.card}>
          <Text style={s.h2}>Foto (opcional)</Text>
          {photo
            ? (
              <View style={{ gap: 8 }}>
                <Image source={{ uri: photo }} style={{ width: '100%', height: 200, borderRadius: 8 }} resizeMode="cover" />
                <Pressable onPress={() => setPhoto(null)}><Text style={{ color: colors.info, fontWeight: '600' }}>Quitar foto</Text></Pressable>
              </View>
            )
            : <Button title="Sacar foto del paquete entregado" variant="ghost" onPress={() => nav.push('Photo', { onPhoto: setPhoto })} />}
        </View>
        {!ready && <Notice tone="info">Completá nombre, DNI y firma o foto{cod ? ', y confirmá el cobro' : ''}.</Notice>}
        <Button title="Confirmar entrega" variant="accent" disabled={!ready} busy={busy} onPress={confirm} />
        <Text style={[s.small, { textAlign: 'center' }]}>Si no hay señal, la entrega queda guardada y se envía sola al volver la conexión.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
