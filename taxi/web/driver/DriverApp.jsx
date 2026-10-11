import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Menu, Navigation, Phone, MessageCircle, MapPin, Flag, LogOut, History, Send, Satellite, Bot, ArrowLeft, Banknote, CreditCard, Wallet, X,
} from 'lucide-react';
import { createApi, getToken, setToken } from '../lib/api';
import { usePoll, useAsync, useConfig, useCountdown } from '../lib/hooks';
import { fmtMoney, fmtKm, fmtMin, fmtDateTime, fmtTime, initials, PAYMENT } from '../lib/format';
import { BaseMap, CarMarker, Pin, Route, FitTo } from '../components/Map';
import { Stars, Rating, ErrorMsg, Logo } from '../components/ui';
import PhoneFrame from '../components/PhoneFrame';
import AuthScreen from '../components/AuthScreen';

const api = createApi('driver');
const QUICK_MSGS = ['Estoy llegando', 'Ya estoy en la puerta', 'Hay mucho tránsito', 'Te espero'];
const navUrl = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;

export default function DriverApp() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!getToken('driver')) { setChecked(true); return; }
    api('/me').then((u) => (u.role === 'driver' ? setUser(u) : setToken('driver', null))).catch(() => {}).finally(() => setChecked(true));
  }, []);
  return (
    <PhoneFrame side={<SidePanel />}>
      <div className="mobile-app">
        {!checked ? null : user ? <Driver user={user} onLogout={() => { setToken('driver', null); setUser(null); }} /> : <AuthScreen app="driver" onLogin={setUser} />}
      </div>
    </PhoneFrame>
  );
}

function SidePanel() {
  return (
    <div className="stack">
      <h2>App del conductor</h2>
      <p className="muted">Conectate y pedí un viaje desde la <Link to="/pasajero" target="_blank">app del pasajero</Link>: la oferta te llega primero a vos, con cuenta regresiva.</p>
      <p className="muted">En modo <b>simulado</b> el auto se mueve solo por la ruta (ideal para presentar). En modo <b>GPS real</b> usa la ubicación del celular.</p>
    </div>
  );
}

function Driver({ user, onLogout }) {
  const cfg = useConfig();
  const { data: s, refresh } = usePoll(() => api('/driver/state'), 1500);
  const [menu, setMenu] = useState(false);
  const [screen, setScreen] = useState(null); // history
  const [summary, setSummary] = useState(null);
  const toggle = useAsync(async () => { await api('/driver/status', { method: 'POST', body: { online: s.driver.status === 'offline' } }); refresh(); });

  useGps(s?.driver && !s.driver.simulate && s.driver.status !== 'offline');

  if (!s || !cfg) return <div className="screen" style={{ display: 'grid', placeItems: 'center' }}><div className="spinner" /></div>;
  if (screen === 'history') return <DriverHistory onBack={() => setScreen(null)} />;
  if (summary) return <TripSummary trip={summary} onDone={() => { setSummary(null); refresh(); }} />;

  const d = s.driver;
  const online = d.status !== 'offline';
  const trip = s.trip;
  const me = d.lat != null ? { lat: d.lat, lng: d.lng } : cfg.center;

  return (
    <>
      <BaseMap center={me} zoom={15}>
        <CarMarker lat={d.lat} lng={d.lng} heading={d.heading} />
        {trip && trip.status !== 'in_progress' && <Pin point={trip.origin} type="origin" />}
        {trip && <Pin point={trip.dest} type="dest" />}
        {trip?.status === 'accepted' && <Route coords={trip.pickup_route} color="#2563eb" />}
        {trip?.status === 'in_progress' && <Route coords={trip.route} color="#2563eb" />}
        {s.offer && <><Pin point={s.offer.trip.origin} type="origin" /><Route coords={s.offer.trip.route} dashed weight={4} /></>}
        <FitTo
          points={s.offer ? [me, s.offer.trip.origin, s.offer.trip.dest] : trip ? [me, trip.status === 'in_progress' ? trip.dest : trip.origin] : [me]}
          fitKey={`${s.offer?.id ?? ''}-${trip?.id ?? ''}-${trip?.status ?? ''}-${online}`}
          paddingBottom={300}
        />
      </BaseMap>

      <div className="top-bar">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenu(true)}><Menu size={20} /></button>
        <span className="grow" />
        <div className="earn-pill"><small>Hoy</small>{fmtMoney(s.today.earnings_cents)}</div>
      </div>

      {!trip && !s.offer && (
        <div className="sheet">
          <div className="row between" style={{ marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>{online ? 'Estás en línea' : 'Estás desconectado'}</h3>
              <div className="small muted">{online ? 'Buscando viajes cerca tuyo…' : 'Conectate para empezar a recibir viajes'}</div>
            </div>
            <button className={`online-toggle ${online ? 'on' : ''}`} disabled={toggle.busy} onClick={() => toggle.run()} aria-pressed={online}>
              {online ? 'En línea' : 'Conectar'} <span className="knob" />
            </button>
          </div>
          <ErrorMsg error={toggle.error} />
          <div className="row" style={{ gap: 8 }}>
            <Stat label="Viajes hoy" value={s.today.trips} />
            <Stat label="Ganancia" value={fmtMoney(s.today.earnings_cents)} />
            <Stat label="Propinas" value={fmtMoney(s.today.tips_cents)} />
          </div>
          <div className="row small muted" style={{ marginTop: 10, gap: 6 }}>
            {d.simulate ? <Bot size={15} /> : <Satellite size={15} />}
            {d.simulate ? 'Modo demo: el auto se mueve solo' : 'GPS del celular activo'} · {d.vehicle.brand} {d.vehicle.model} · <span className="plate">{d.vehicle.plate}</span>
          </div>
        </div>
      )}

      {s.offer && !trip && <OfferCard offer={s.offer} refresh={refresh} />}
      {trip && <ActiveTrip trip={trip} messages={s.messages} refresh={refresh} onCompleted={setSummary} />}

      {menu && (
        <div className="screen" onClick={() => setMenu(false)} style={{ background: 'rgba(0,0,0,.35)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', width: '80%', height: '100%', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Logo brand={cfg.brand} />
            <div className="row" style={{ margin: '24px 0 8px' }}>
              <span className="avatar">{initials(user.name)}</span>
              <div><div className="bold">{user.name}</div><div className="small muted"><Rating value={d.rating} /> · Móvil {d.vehicle.unit_number}</div></div>
            </div>
            <div className="card" style={{ padding: 14, marginBottom: 8 }}>
              <div className="bold small" style={{ marginBottom: 8 }}>Ubicación</div>
              <ModeSwitch simulate={d.simulate} refresh={refresh} />
            </div>
            <button className="place-row" onClick={() => { setMenu(false); setScreen('history'); }}><span className="ic"><History size={18} /></span><span className="bold">Mis viajes y ganancias</span></button>
            <button className="place-row" onClick={onLogout}><span className="ic"><LogOut size={18} /></span><span className="bold">Cerrar sesión</span></button>
          </div>
        </div>
      )}
    </>
  );
}

const Stat = ({ label, value }) => (
  <div className="card grow" style={{ padding: 12 }}>
    <div className="xs muted bold">{label}</div>
    <div className="bold" style={{ fontSize: '1.1rem' }}>{value}</div>
  </div>
);

function ModeSwitch({ simulate, refresh }) {
  const set = async (v) => {
    if (!v && !navigator.geolocation) return alert('Este dispositivo no tiene GPS disponible');
    await api('/driver/mode', { method: 'POST', body: { simulate: v } });
    refresh();
  };
  return (
    <div className="row" style={{ gap: 6 }}>
      <button className={`chip ${simulate ? 'on' : ''}`} onClick={() => set(true)}><Bot size={14} /> Simulado</button>
      <button className={`chip ${!simulate ? 'on' : ''}`} onClick={() => set(false)}><Satellite size={14} /> GPS real</button>
    </div>
  );
}

// Envía la ubicación real del celular cuando el modo simulado está apagado.
function useGps(enabled) {
  const last = useRef(0);
  useEffect(() => {
    if (!enabled || !navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition((pos) => {
      if (Date.now() - last.current < 3000) return;
      last.current = Date.now();
      api('/driver/location', { method: 'POST', body: { lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading ?? null } }).catch(() => {});
    }, () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);
}

function OfferCard({ offer, refresh }) {
  const left = useCountdown(offer.expires_at);
  const total = Math.max(1, Math.round((new Date(offer.expires_at) - new Date(offer.offered_at)) / 1000));
  const t = offer.trip;
  const accept = useAsync(async () => { await api(`/driver/offers/${offer.id}/accept`, { method: 'POST' }); refresh(); });
  const reject = useAsync(async () => { await api(`/driver/offers/${offer.id}/reject`, { method: 'POST' }); refresh(); });
  const C = 2 * Math.PI * 28;
  // Vibración al llegar una oferta (si el dispositivo lo permite).
  useEffect(() => { try { navigator.vibrate?.([200, 100, 200]); } catch {} }, [offer.id]);
  return (
    <div className="offer-card">
      <div className="row between">
        <div>
          <div className="small muted">Nuevo viaje · {t.category === 'taxi' ? 'Taxi' : t.category === 'xl' ? 'XL' : 'Ejecutivo'} · {PAYMENT[t.payment_method]}</div>
          <div className="fare">{fmtMoney(t.fare_cents)}</div>
        </div>
        <div className="ring">
          <svg width="64" height="64"><circle cx="32" cy="32" r="28" stroke="#333" strokeWidth="6" fill="none" /><circle cx="32" cy="32" r="28" stroke="#FFC300" strokeWidth="6" fill="none" strokeDasharray={C} strokeDashoffset={C * (1 - left / total)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .25s linear' }} /></svg>
          <span>{left}</span>
        </div>
      </div>
      <div className="stack" style={{ gap: 8, margin: '12px 0 16px' }}>
        <div className="row" style={{ alignItems: 'flex-start' }}><MapPin size={18} style={{ flexShrink: 0, marginTop: 2 }} /><div><div className="bold">{t.origin.address}</div><div className="small muted">A {fmtKm(offer.pickup_distance_m ?? 0)} de vos</div></div></div>
        <div className="row" style={{ alignItems: 'flex-start' }}><Flag size={18} color="#FFC300" style={{ flexShrink: 0, marginTop: 2 }} /><div><div className="bold">{t.dest.address}</div><div className="small muted">{fmtKm(t.distance_m)} · {fmtMin(t.duration_s)} de viaje</div></div></div>
        {t.notes && <div className="small" style={{ color: '#FFC300' }}>Nota: {t.notes}</div>}
        {t.source === 'central' && <div className="small muted">Pedido de la central telefónica · {t.rider?.name}</div>}
      </div>
      <ErrorMsg error={accept.error} />
      <div className="row" style={{ gap: 10 }}>
        <button className="btn" style={{ background: '#2a2a28' }} disabled={reject.busy || accept.busy} onClick={() => reject.run()}><X size={18} /></button>
        <button className="btn brand lg grow" disabled={accept.busy} onClick={() => accept.run()}>Aceptar viaje</button>
      </div>
    </div>
  );
}

function ActiveTrip({ trip, messages, refresh, onCompleted }) {
  const [chat, setChat] = useState(false);
  const act = useAsync(async (action) => {
    const t = await api(`/driver/trips/${trip.id}/${action}`, { method: 'POST', body: action === 'cancel' ? { reason: 'Cancelado por el conductor' } : undefined });
    if (action === 'complete') onCompleted(t);
    refresh();
  });
  const r = trip.rider ?? {};
  const target = trip.status === 'in_progress' ? trip.dest : trip.origin;
  const step = {
    accepted: { banner: `Buscá a ${r.name?.split(' ')[0] ?? 'tu pasajero'}`, sub: `${trip.eta_min ?? '-'} min · ${trip.origin.address}`, action: 'arrived', label: 'Llegué' },
    arrived: { banner: `Esperando a ${r.name?.split(' ')[0] ?? 'tu pasajero'}`, sub: trip.origin.address, action: 'start', label: 'Iniciar viaje' },
    in_progress: { banner: `Llevá a ${r.name?.split(' ')[0] ?? 'tu pasajero'}`, sub: `${trip.eta_min ?? '-'} min · ${trip.dest.address}`, action: 'complete', label: 'Finalizar viaje' },
  }[trip.status];
  const unread = messages.filter((m) => m.sender === 'rider').length;
  return (
    <div className="sheet">
      <div className="stack">
        <div className="step-banner"><Navigation size={20} /><div className="grow"><div>{step.banner}</div><div className="small" style={{ fontWeight: 600 }}>{step.sub}</div></div></div>
        <div className="row">
          <span className="avatar">{initials(r.name ?? '?')}</span>
          <div className="grow">
            <div className="bold">{r.name ?? 'Pasajero'}</div>
            <div className="small muted">{r.rating ? <Rating value={r.rating} /> : 'Pedido telefónico'} · {fmtMoney(trip.fare_cents)} · {PAYMENT[trip.payment_method]}</div>
          </div>
        </div>
        {trip.notes && <div className="alert warn small">Nota: {trip.notes}</div>}
        <div className="actions">
          <a className="btn ghost grow" href={navUrl(target)} target="_blank" rel="noreferrer"><Navigation size={18} /> Navegar</a>
          {r.phone && <a className="btn ghost grow" href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}><Phone size={18} /> Llamar</a>}
          {trip.source === 'app' && <button className="btn ghost grow" onClick={() => setChat(!chat)}><MessageCircle size={18} />{unread ? ` ${unread}` : ''}</button>}
        </div>
        {chat && <DriverChat trip={trip} messages={messages} refresh={refresh} />}
        <ErrorMsg error={act.error} />
        <button className={`btn lg block ${trip.status === 'in_progress' ? 'good' : 'brand'}`} disabled={act.busy} onClick={() => act.run(step.action)}>{step.label}</button>
        {trip.status !== 'in_progress' && <button className="btn danger sm" disabled={act.busy} onClick={() => confirm('¿Cancelar el viaje? Se le asignará otro conductor al pasajero.') && act.run('cancel')}>Cancelar viaje</button>}
      </div>
    </div>
  );
}

function DriverChat({ trip, messages, refresh }) {
  const [text, setText] = useState('');
  const send = async (t) => { if (!t.trim()) return; await api(`/driver/trips/${trip.id}/messages`, { method: 'POST', body: { text: t } }); setText(''); refresh(); };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="chat-box">
        {messages.length === 0 && <div className="small muted center">Sin mensajes</div>}
        {messages.map((m, i) => <div key={i} className={`msg ${m.sender === 'driver' ? 'me' : 'them'}`}>{m.text}</div>)}
      </div>
      <div className="quick-msgs">{QUICK_MSGS.map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}</div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input placeholder="Mensaje" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="icon-btn flat" aria-label="Enviar"><Send size={18} /></button>
      </form>
    </div>
  );
}

function TripSummary({ trip, onDone }) {
  const [stars, setStars] = useState(5);
  const rate = useAsync(async () => { if (trip.rider?.rating != null) await api(`/driver/trips/${trip.id}/rate`, { method: 'POST', body: { stars } }); onDone(); });
  const Icon = { cash: Banknote, card: CreditCard, mercadopago: Wallet }[trip.payment_method] ?? Banknote;
  return (
    <div className="screen">
      <div className="screen-body stack" style={{ gap: 18, paddingTop: 48, textAlign: 'center', alignItems: 'center' }}>
        <span className="badge good">Viaje finalizado</span>
        <div className="row" style={{ justifyContent: 'center' }}><Icon size={22} /> <b>{trip.payment_method === 'cash' ? 'Cobrá en efectivo' : `Cobrado con ${PAYMENT[trip.payment_method]}`}</b></div>
        <div style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-.03em' }}>{fmtMoney(trip.fare_cents)}</div>
        <div className="small muted">{trip.origin.address} → {trip.dest.address} · {fmtKm(trip.distance_m)}</div>
        {trip.rider?.rating != null && (
          <>
            <h3 style={{ margin: '10px 0 0' }}>Calificá a {trip.rider.name?.split(' ')[0]}</h3>
            <Stars value={stars} onChange={setStars} size={36} />
          </>
        )}
        <ErrorMsg error={rate.error} />
        <button className="btn brand lg block" disabled={rate.busy} onClick={() => rate.run()}>Listo, buscar otro viaje</button>
      </div>
    </div>
  );
}

function DriverHistory({ onBack }) {
  const { data } = usePoll(() => api('/driver/trips'), 15000);
  const done = (data ?? []).filter((t) => t.status === 'completed');
  const total = done.reduce((a, t) => a + t.fare_cents + (t.tip_cents ?? 0), 0);
  return (
    <div className="screen">
      <div className="screen-head"><button className="icon-btn flat" aria-label="Volver" onClick={onBack}><ArrowLeft size={20} /></button><h3 style={{ margin: 0 }}>Mis viajes</h3></div>
      <div className="screen-body stack">
        <div className="card" style={{ background: 'var(--ink)', color: '#fff', border: 'none' }}>
          <div className="small" style={{ color: '#FFC300' }}>Facturado (últimos viajes)</div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{fmtMoney(total)}</div>
          <div className="small" style={{ color: '#bbb' }}>{done.length} viajes completados</div>
        </div>
        {(data ?? []).map((t) => (
          <div key={t.id} className="card" style={{ padding: 14 }}>
            <div className="row between"><span className="small muted">{fmtDateTime(t.requested_at)}</span><span className="bold">{fmtMoney(t.fare_cents + (t.tip_cents ?? 0))}</span></div>
            <div className="small ellipsis" style={{ marginTop: 4 }}>{t.origin.address} → {t.dest.address}</div>
            <div className="xs muted">{t.status === 'completed' ? `${PAYMENT[t.payment_method]}${t.tip_cents ? ` · propina ${fmtMoney(t.tip_cents)}` : ''} · ${fmtTime(t.completed_at)}` : 'Cancelado'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
