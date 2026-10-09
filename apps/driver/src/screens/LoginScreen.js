import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { saveSession, getSession } from '../session';
import { Button, Field, Notice } from '../components/ui';
import { colors, s } from '../theme';

export default function LoginScreen({ onLogin }) {
  const insets = useSafeAreaInsets();
  const [server, setServer] = useState(getSession().server);
  const [showServer, setShowServer] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const base = server.trim().replace(/\/$/, '');
      const { token, user } = await api('/auth/login', { method: 'POST', server: base, token: null, body: { email: email.trim().toLowerCase(), password } });
      if (user.role !== 'driver') throw new Error('Esta app es solo para transportistas.');
      await saveSession({ token, user, server: base });
      onLogin(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 48 }]} keyboardShouldPersistTaps="handled">
        <View style={[s.row, { marginBottom: 8 }]}>
          <View style={{ backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>4B</Text>
          </View>
          <Text style={[s.h1, { color: colors.brand }]}>Expreso 4 Bahía</Text>
        </View>
        <Text style={s.muted}>App del transportista</Text>
        <View style={[s.card, { gap: 12, marginTop: 12 }]}>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
          {showServer
            ? <Field label="Servidor (URL de la API)" value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            : (
              <Pressable onPress={() => setShowServer(true)}>
                <Text style={s.small}>Servidor: {server} <Text style={{ color: colors.info }}>Cambiar</Text></Text>
              </Pressable>
            )}
          {error && <Notice tone="bad">{error}</Notice>}
          <Button title="Ingresar" onPress={submit} busy={busy} disabled={!email || !password} variant="accent" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
