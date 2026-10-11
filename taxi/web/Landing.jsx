import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { Smartphone, CarFront, LayoutDashboard, MapPinned, PhoneCall, Timer, ShieldCheck, Wallet, MessageCircle, Star } from 'lucide-react';
import { useConfig } from './lib/hooks';
import { Logo } from './components/ui';

function Qr({ path }) {
  const [svg, setSvg] = useState('');
  useEffect(() => { QRCode.toString(`${location.origin}${path}`, { type: 'svg', margin: 0 }).then(setSvg).catch(() => {}); }, [path]);
  return <div className="qr" aria-label={`Código QR para abrir ${path}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function Landing() {
  const cfg = useConfig();
  const brand = cfg?.brand ?? 'Movi';
  return (
    <div className="landing">
      <div className="wrap">
        <header>
          <Logo brand={brand} light />
          <Link to="/admin" className="btn brand sm">Panel de administración</Link>
        </header>
        <section className="hero">
          <div>
            <span className="badge brand" style={{ marginBottom: 18 }}>Demo · {cfg?.city ?? ''}</span>
            <h1>La app de viajes <em>para tu empresa de taxis</em></h1>
            <p>Pasajeros que piden desde el celular, conductores que reciben viajes con un toque y una central que ve toda la flota en vivo.</p>
            <div className="row wrap" style={{ marginTop: 22 }}>
              <Link to="/pasajero" className="btn brand lg">Probar como pasajero</Link>
              <Link to="/conductor" className="btn lg" style={{ background: '#222' }}>Probar como conductor</Link>
            </div>
          </div>
          <div className="feature-grid" style={{ paddingBottom: 0 }}>
            {[[MapPinned, 'Seguimiento en vivo', 'El pasajero ve el auto acercarse en el mapa.'], [PhoneCall, 'Central telefónica', 'Cargá pedidos por teléfono y asignalos.'], [Timer, 'Asignación automática', 'Ofrece el viaje al conductor más cercano.'], [Wallet, 'Tarifas y liquidaciones', 'Bajada, km, minuto, nocturna y comisión.']].map(([I, t, d]) => (
              <div key={t} className="feature"><I size={22} /><h3>{t}</h3><p>{d}</p></div>
            ))}
          </div>
        </section>
        <section className="apps">
          <Link to="/pasajero" className="app-card">
            <span className="ic"><Smartphone size={26} /></span>
            <h2 style={{ color: '#fff', margin: 0 }}>App del pasajero</h2>
            <p>Elegí destino, compará precios por categoría, pedí y seguí a tu conductor. Chat, compartir viaje, propina y calificación.</p>
            <Qr path="/pasajero" />
            <span className="small" style={{ color: '#FFC300' }}>Escaneá con el celular →</span>
          </Link>
          <Link to="/conductor" className="app-card">
            <span className="ic"><CarFront size={26} /></span>
            <h2 style={{ color: '#fff', margin: 0 }}>App del conductor</h2>
            <p>Conectate, aceptá viajes con cuenta regresiva, navegá con Google Maps, cobrá y mirá tus ganancias del día.</p>
            <Qr path="/conductor" />
            <span className="small" style={{ color: '#FFC300' }}>Escaneá con el celular →</span>
          </Link>
          <Link to="/admin" className="app-card">
            <span className="ic"><LayoutDashboard size={26} /></span>
            <h2 style={{ color: '#fff', margin: 0 }}>Panel de administración</h2>
            <p>Mapa de la flota en vivo, central telefónica, viajes, conductores, pasajeros, tarifas, promociones y liquidaciones.</p>
            <div className="stack" style={{ gap: 8, marginTop: 'auto' }}>
              {[[ShieldCheck, 'Conductores aprobados y documentación'], [MessageCircle, 'Chat pasajero ↔ conductor'], [Star, 'Calificaciones y propinas']].map(([I, t]) => <span key={t} className="row small" style={{ color: '#cfcec8' }}><I size={16} color="#FFC300" /> {t}</span>)}
            </div>
          </Link>
        </section>
        <p className="small center" style={{ color: '#6f6e69', paddingBottom: 32 }}>
          Para probar todo el circuito: abrí la app del pasajero y la del conductor (en dos pestañas o en dos celulares) y el panel en la compu.
          {cfg?.quick_login ? ' Cada app tiene un botón "Entrar con la cuenta demo".' : ''}
        </p>
      </div>
    </div>
  );
}
