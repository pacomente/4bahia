import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Header } from '../components/ui';
import { s } from '../theme';

// Foto del comprobante. Calidad baja para que viaje rápido con poca señal.
export default function PhotoScreen({ nav, params }) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef(null);
  const [busy, setBusy] = useState(false);

  async function take() {
    setBusy(true);
    try {
      const pic = await camera.current.takePictureAsync({ quality: 0.3, base64: true, shutterSound: false });
      params.onPhoto(`data:image/jpeg;base64,${pic.base64}`);
      nav.pop();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.screen}>
      <Header title="Foto de entrega" onBack={nav.pop} />
      {!permission ? null : !permission.granted ? (
        <View style={s.content}>
          <Text style={s.text}>Necesitamos la cámara para sacar la foto del comprobante.</Text>
          <Button title="Permitir cámara" onPress={requestPermission} />
        </View>
      ) : (
        <>
          <CameraView ref={camera} style={{ flex: 1 }} facing="back" />
          <View style={s.content}><Button title="Sacar foto" variant="accent" busy={busy} onPress={take} /></View>
        </>
      )}
    </View>
  );
}
