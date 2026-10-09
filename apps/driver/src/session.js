import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Sesión y servidor guardados en el almacenamiento seguro del teléfono.
const KEYS = { token: 'token', user: 'user', server: 'server' };
export const DEFAULT_SERVER = Constants.expoConfig?.extra?.apiUrl ?? 'http://10.0.2.2:3000/api';

let memory = { token: null, user: null, server: DEFAULT_SERVER };

export async function loadSession() {
  const [token, user, server] = await Promise.all([
    SecureStore.getItemAsync(KEYS.token),
    SecureStore.getItemAsync(KEYS.user),
    SecureStore.getItemAsync(KEYS.server),
  ]);
  memory = { token, user: user ? JSON.parse(user) : null, server: server || DEFAULT_SERVER };
  return memory;
}

export async function saveSession({ token, user, server }) {
  memory = { token, user, server };
  await Promise.all([
    SecureStore.setItemAsync(KEYS.token, token),
    SecureStore.setItemAsync(KEYS.user, JSON.stringify(user)),
    SecureStore.setItemAsync(KEYS.server, server),
  ]);
}

export async function clearSession() {
  memory = { ...memory, token: null, user: null };
  await Promise.all([SecureStore.deleteItemAsync(KEYS.token), SecureStore.deleteItemAsync(KEYS.user)]);
}

export const getSession = () => memory;
