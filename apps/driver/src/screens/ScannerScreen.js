import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Header } from '../components/ui';
import { s } from '../theme';

// Escaneo de la etiqueta (QR). También permite tipear el código si la etiqueta está dañada.
export default function ScannerScreen({ nav, params }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const handled = useRef(false);

  const done = (raw) => {
    if (handled.current) return;
    const code = String(raw).trim().toUpperCase().match(/4B\d{10}/)?.[0] ?? String(raw).trim().toUpperCase();
    handled.current = true;
    params.onScanned(code);
  };

  return (
    <View style={s.screen}>
      <Header title="Escanear etiqueta" onBack={nav.pop} />
      {!permission ? null : !permission.granted ? (
        <View style={s.content}>
          <Text style={s.text}>Necesitamos la cámara para leer el código QR de la etiqueta.</Text>
          <Button title="Permitir cámara" onPress={requestPermission} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128'] }}
            onBarcodeScanned={(r) => done(r.data)}
          />
          <View pointerEvents="none" style={{ position: 'absolute', top: '25%', left: '15%', right: '15%', aspectRatio: 1, borderWidth: 3, borderColor: '#fff', borderRadius: 16 }} />
        </View>
      )}
      <View style={[s.content, s.row]}>
        <TextInput style={[s.input, { flex: 1 }]} placeholder="o escribí el código" autoCapitalize="characters" value={manual} onChangeText={setManual} onSubmitEditing={() => manual && done(manual)} />
        <Button title="OK" onPress={() => manual && done(manual)} disabled={!manual} />
      </View>
    </View>
  );
}
