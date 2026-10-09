import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

export const metadata = {
  title: 'Expreso 4 Bahía · Encomiendas y cargas',
  description: 'Seguí tu envío, cotizá al instante y gestioná tus encomiendas con Expreso 4 Bahía.',
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#e1251b' };

export default function RootLayout({ children }) {
  return (
    <html lang="es-AR" className={jakarta.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
