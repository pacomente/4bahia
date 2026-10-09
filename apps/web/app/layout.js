import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata = {
  title: 'Expreso 4 Bahía',
  description: 'Encomiendas y cargas: seguimiento, cotizaciones y gestión logística.',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="es-AR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
