import { registerRootComponent } from 'expo';

// La tarea de GPS en segundo plano debe quedar definida antes de registrar la app.
import './src/location';
import App from './App';

registerRootComponent(App);
