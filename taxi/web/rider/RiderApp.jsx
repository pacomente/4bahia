import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Menu, ArrowLeft, MapPin, Banknote, CreditCard, Wallet, Tag, Phone, MessageCircle, Share2, X, Clock, LogOut, History, Send, Check, Crosshair,
} from 'lucide-react';
import { createApi, getToken, setToken } from '../lib/api';
import { usePoll, useAsync, useConfig } from '../lib/hooks';
import { fmtMoney, fmtKm, fmtMin, fmtDateTime, initials, PAYMENT } from '../lib/format';
import { BaseMap, CarMarker, Pin, Route, FitTo, MapClick, CenterWatcher } from '../components/Map';
import { Stars, Rating, CarSide, ErrorMsg, Logo, StatusBadge } from '../components/ui';
import PlaceSearch from '../components/PlaceSearch';
import PhoneFrame from '../components/PhoneFrame';
import AuthScreen from '../components/AuthScreen';

const api = createApi('rider');
const QUICK_MSGS = ['Estoy en la puerta', 'Ya bajo', 'Llevo equipaje', '¿Cuánto falta?'];
const near = (a, b, km) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 92) < km;

export default function RiderApp() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!getToken('rider')) { setChecked(true); return; }
    api('/me').then((u) => (u.role === 'rider' ? setUser(u) : setToken('rider', null))).catch(() => {}).finally(() => setChecked(true));
  }, []);
  return (
    <PhoneFrame side={<SidePanel />}>
      <div className="mobile-app">
        {!checked ? null : user ? <Rider user={user} onLogout={() => { setToken('rider', null); setUser(null); }} /> : <AuthScreen app="rider" onLogin={setUser} />}
      </div>
    </PhoneFrame>
  );
}

function SidePanel() {
  return (
    <div className="stack">
      <h2>App del pasajero</h2>
      <p className="muted">Pedí un viaje y seguí al conductor en el mapa en tiempo real.</p>
      <p className="muted">Para recibir el pedido vos mismo, abrí la <Link to="/conductor" target="_blank">app del conductor</Link> en otra pestaña o en tu celular y conectate. Si no, lo toma un conductor simulado.</p>
      <p className="muted">Todo se refleja en el <Link to="/admin" target="_blank">panel de administración</Link>.</p>
    </div>
  );
}

function Rider({ user, onLogout }) {
  const cfg = useConfig();
  const center = cfg?.center ?? { lat: -34.6037, lng: -58.3816 };
  const { data: state, refresh } = usePoll(() => api('/rider/state'), 2000);
  const trip = state?.trip;
  if (!cfg || !state) return <div className="screen" style={{ display: 'grid', placeItems: 'center' }}><div className="spinner" /></div>;
  return trip
    ? <TripView key={trip.id} trip={trip} messages={state.messages} refresh={refresh} cfg={cfg} />
    : <Planner user={user} cfg={cfg} center={center} onRequested={refresh} onLogout={onLogout} />;
}

// ───────── Planificar el viaje ─────────
function Planner({ user, cfg, center, onRequested, onLogout }) {
  const [origin, setOrigin] = useState({ ...center, address: 'Ubicación actual' });
  const [dest, setDest] = useState(null);
  const [step, setStep] = useState('home');        // home | search | pick | quote | history
  const [searchFor, setSearchFor] = useState('dest');
  const [pickPoint, setPickPoint] = useState(center);
  const [menu, setMenu] = useState(false);
  const [recent, setRecent] = useState([]);
  const [quoteRoute, setQuoteRoute] = useState(null);
  const { data: cars } = usePoll(() => fetch(`/api/public/nearby?lat=${origin.lat}&lng=${origin.lng}`).then((r) => r.json()), step === 'home' || step === 'quote' ? 3000 : 0, [origin.lat, origin.lng]);

  // Ubicación real del celular si está dentro de la ciudad de la demo.
  const locate = (force) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (near(p, center, 30)) setOrigin({ ...p, address: 'Ubicación actual' });
      else if (force) alert(`Tu ubicación está fuera de ${cfg.city}. La demo usa el centro de la ciudad.`);
    }, () => {}, { enableHighAccuracy: true, timeout: 8000 });
  };
  useEffect(() => { locate(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api('/rider/trips').then((ts) => setRecent([...new Map(ts.map((t) => [t.dest.address, { name: t.dest.address, address: 'Viaje anterior', lat: t.dest.lat, lng: t.dest.lng }])).values()].slice(0, 3))).catch(() => {}); }, []);

  const pick = (p) => {
    if (searchFor === 'origin') { setOrigin(p); setStep(dest ? 'quote' : 'search'); setSearchFor('dest'); }
    else { setDest(p); setStep('quote'); }
  };

  if (step === 'history') return <HistoryScreen onBack={() => setStep('home')} />;

  return (
    <>
      <BaseMap center={center} zoom={14}>
        {step === 'pick' && <CenterWatcher onMove={setPickPoint} />}
        {step !== 'pick' && <Pin point={origin} type="me" />}
        {step === 'quote' && dest && <Pin point={dest} type="dest" />}
        {(step === 'home' || step === 'quote') && cars?.map((c) => <CarMarker key={c.id} lat={c.lat} lng={c.lng} heading={c.heading} color={c.category === 'ejecutivo' ? '#2b2b2b' : c.category === 'xl' ? '#e9e8e3' : '#FFC300'} />)}
        {step === 'home' && <FitTo points={[origin]} fitKey={`${origin.lat},${origin.lng}`} />}
        {step === 'quote' && dest && (
          <>
            <Route coords={quoteRoute} />
            <FitTo points={quoteRoute ?? [origin, dest]} fitKey={`${quoteRoute?.length}-${dest.lat}-${origin.lat}`} paddingBottom={380} />
          </>
        )}
      </BaseMap>

      {step === 'pick' && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', zIndex: 450, transform: 'translate(-50%, -100%)', pointerEvents: 'none' }}>
          <MapPin size={44} fill={searchFor === 'origin' ? '#111' : '#FFC300'} color="#111" strokeWidth={1.6} />
        </div>
      )}

      <div className="top-bar">
        {step === 'home'
          ? <button className="icon-btn" aria-label="Menú" onClick={() => setMenu(true)}><Menu size={20} /></button>
          : <button className="icon-btn" aria-label="Volver" onClick={() => setStep(step === 'quote' ? 'home' : step === 'pick' ? 'search' : 'home')}><ArrowLeft size={20} /></button>}
        <span className="grow" />
        {step === 'home' && <button className="icon-btn" aria-label="Mi ubicación" onClick={() => locate(true)}><Crosshair size={20} /></button>}
      </div>

      {step === 'home' && (
        <div className="sheet">
          <h2 style={{ marginBottom: 12 }}>Hola, {user.name.split(' ')[0]}</h2>
          <button className="where-to" onClick={() => { setSearchFor('dest'); setStep('search'); }}>
            <MapPin size={20} /> ¿A dónde vamos?
          </button>
          <div className="row" style={{ marginTop: 12, gap: 8, overflowX: 'auto' }}>
            {recent.concat([]).slice(0, 3).map((p) => (
              <button key={p.name} className="chip" onClick={() => { setDest({ lat: p.lat, lng: p.lng, address: p.name }); setStep('quote'); }}><Clock size={14} /> {p.name}</button>
            ))}
          </div>
          <p className="small muted" style={{ margin: '12px 0 0' }}>{cars?.length ?? 0} autos disponibles cerca tuyo</p>
        </div>
      )}

      {step === 'search' && (
        <div className="screen">
          <div className="screen-head">
            <button className="icon-btn flat" aria-label="Volver" onClick={() => setStep('home')}><ArrowLeft size={20} /></button>
            <div className="grow">
              <div className="route-inputs">
                <div className="route-dots"><span className="o" /><span className="l" /><span className="d" /></div>
                <div className="grow stack" style={{ gap: 6 }}>
                  <button className="chip" style={{ justifyContent: 'flex-start', borderRadius: 12, fontWeight: searchFor === 'origin' ? 800 : 600, borderColor: searchFor === 'origin' ? '#111' : undefined }} onClick={() => setSearchFor('origin')}>
                    <span className="ellipsis">{origin.address}</span>
                  </button>
                  <button className="chip" style={{ justifyContent: 'flex-start', borderRadius: 12, fontWeight: searchFor === 'dest' ? 800 : 600, borderColor: searchFor === 'dest' ? '#111' : undefined }} onClick={() => setSearchFor('dest')}>
                    <span className="ellipsis">{dest?.address ?? '¿A dónde vamos?'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="screen-body">
            <PlaceSearch
              key={searchFor}
              center={center}
              city={cfg.city}
              placeholder={searchFor === 'origin' ? '¿Dónde te buscamos?' : '¿A dónde vamos?'}
              recent={searchFor === 'dest' ? recent : []}
              onPick={pick}
              onPickOnMap={() => { setPickPoint(searchFor === 'origin' ? origin : (dest ?? origin)); setStep('pick'); }}
              onUseMyLocation={searchFor === 'origin' ? () => { locate(true); setSearchFor('dest'); } : undefined}
            />
          </div>
        </div>
      )}

      {step === 'pick' && (
        <div className="sheet">
          <h3>{searchFor === 'origin' ? 'Mové el mapa hasta el punto de encuentro' : 'Mové el mapa hasta tu destino'}</h3>
          <button className="btn brand lg block" onClick={() => pick({ ...pickPoint, address: searchFor === 'origin' ? 'Punto de encuentro elegido' : 'Destino elegido en el mapa' })}>Confirmar ubicación</button>
        </div>
      )}

      {step === 'quote' && dest && <QuoteSheet origin={origin} dest={dest} onQuote={(q) => setQuoteRoute(q?.route ?? null)} onRequested={onRequested} onEdit={() => setStep('search')} />}

      {menu && (
        <div className="screen" onClick={() => setMenu(false)} style={{ background: 'rgba(0,0,0,.35)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', width: '78%', height: '100%', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Logo brand={cfg.brand} />
            <div className="row" style={{ margin: '24px 0 16px' }}>
              <span className="avatar">{initials(user.name)}</span>
              <div><div className="bold">{user.name}</div><div className="small muted"><Rating value={user.rating} /></div></div>
            </div>
            <button className="place-row" onClick={() => { setMenu(false); setStep('history'); }}><span className="ic"><History size={18} /></span><span className="bold">Mis viajes</span></button>
            <button className="place-row" onClick={onLogout}><span className="ic"><LogOut size={18} /></span><span className="bold">Cerrar sesión</span></button>
          </div>
        </div>
      )}
    </>
  );
}

function QuoteSheet({ origin, dest, onQuote, onRequested, onEdit }) {
  const [quote, setQuote] = useState(null);
  const [category, setCategory] = useState('taxi');
  const [payment, setPayment] = useState('cash');
  const [promo, setPromo] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [showPromo, setShowPromo] = useState(false);
  const load = useAsync(async (code) => {
    const q = await api('/rider/quote', { method: 'POST', body: { origin, dest, promoCode: code || undefined } });
    setQuote(q);
    onQuote(q);
  });
  useEffect(() => { load.run(appliedPromo); }, [origin, dest, appliedPromo]); // eslint-disable-line react-hooks/exhaustive-deps
  const request = useAsync(async () => {
    await api('/rider/trips', { method: 'POST', body: { origin, dest, category, payment_method: payment, promo_code: appliedPromo || undefined } });
    onRequested();
  });
  const selected = quote?.options.find((o) => o.category === category);
  return (
    <div className="sheet">
      <button className="row small muted" style={{ background: 'none', border: 'none', padding: 0, marginBottom: 8, cursor: 'pointer', width: '100%' }} onClick={onEdit}>
        <span className="ellipsis grow" style={{ textAlign: 'left' }}><b style={{ color: 'var(--text)' }}>{origin.address}</b> → <b style={{ color: 'var(--text)' }}>{dest.address}</b></span>
      </button>
      {!quote ? <div className="row" style={{ justifyContent: 'center', padding: 30 }}><div className="spinner" /></div> : (
        <div className="stack" style={{ gap: 6 }}>
          <div className="small muted">{fmtKm(quote.distance_m)} · {fmtMin(quote.duration_s)} de viaje</div>
          {quote.options.map((o) => (
            <button key={o.category} className={`option ${category === o.category ? 'on' : ''}`} disabled={!o.available} onClick={() => setCategory(o.category)} style={{ opacity: o.available ? 1 : 0.45 }}>
              <CarSide category={o.category} />
              <div className="grow">
                <div className="bold">{o.name} <span className="small muted" style={{ fontWeight: 500 }}>· {o.seats} pasajeros</span></div>
                <div className="small muted">{o.available ? `Llega en ${o.pickup_eta_min} min` : 'Sin autos cerca'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="bold" style={{ fontSize: '1.05rem' }}>{fmtMoney(o.total_cents)}</div>
                {o.discount_cents > 0 && <div className="xs" style={{ color: 'var(--good-text)' }}>-{fmtMoney(o.discount_cents)}</div>}
              </div>
            </button>
          ))}
          <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
            {[['cash', Banknote], ['card', CreditCard], ['mercadopago', Wallet]].map(([k, Icon]) => (
              <button key={k} className={`chip ${payment === k ? 'on' : ''}`} onClick={() => setPayment(k)}><Icon size={15} /> {PAYMENT[k]}</button>
            ))}
            <button className={`chip ${appliedPromo ? 'on' : ''}`} onClick={() => setShowPromo(!showPromo)}><Tag size={15} /> {appliedPromo || 'Promo'}</button>
          </div>
          {showPromo && (
            <form className="row" onSubmit={(e) => { e.preventDefault(); setAppliedPromo(promo.trim().toUpperCase()); setShowPromo(false); }}>
              <input placeholder="Código (ej. BIENVENIDA)" value={promo} onChange={(e) => setPromo(e.target.value)} style={{ textTransform: 'uppercase' }} />
              <button className="btn sm">Aplicar</button>
            </form>
          )}
          {quote.promo?.invalid && <div className="alert warn small">El código promocional no es válido.</div>}
          <ErrorMsg error={request.error ?? load.error} />
          <button className="btn brand lg block" style={{ marginTop: 6 }} disabled={request.busy || !selected?.available} onClick={() => request.run()}>
            {request.busy ? 'Pidiendo…' : `Pedir ${selected?.name ?? ''} · ${fmtMoney(selected?.total_cents)}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ───────── Viaje en curso ─────────
function TripView({ trip, messages, refresh, cfg }) {
  const [chat, setChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const cancel = useAsync(async () => { if (confirm('¿Cancelar el viaje?')) { await api(`/rider/trips/${trip.id}/cancel`, { method: 'POST', body: { reason: 'Cancelado desde la app' } }); refresh(); } });
  const d = trip.driver;
  const share = async () => {
    const url = `${location.origin}/viaje/${trip.share_token}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Seguí mi viaje', text: `Estoy viajando con ${cfg.brand}`, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch {}
  };
  const unread = messages.filter((m) => m.sender === 'driver').length;

  if (trip.status === 'completed') return <RateScreen trip={trip} refresh={refresh} />;
  if (trip.status === 'no_drivers' || trip.status === 'cancelled') {
    return (
      <div className="screen" style={{ justifyContent: 'center', padding: 24, textAlign: 'center', gap: 12 }}>
        <div style={{ fontSize: 48 }}>🚕</div>
        <h2>{trip.status === 'no_drivers' ? 'No encontramos conductores' : 'Viaje cancelado'}</h2>
        <p className="muted">{trip.status === 'no_drivers' ? 'Todos los autos están ocupados. Probá de nuevo en unos minutos.' : trip.cancel_reason ?? ''}</p>
        <button className="btn brand lg" onClick={async () => { await api(`/rider/trips/${trip.id}/dismiss`, { method: 'POST' }); refresh(); }}>Volver al inicio</button>
      </div>
    );
  }

  const focus = trip.status === 'in_progress' ? [d && { lat: d.lat, lng: d.lng }, trip.dest] : [d && { lat: d.lat, lng: d.lng }, trip.origin];
  return (
    <>
      <BaseMap center={trip.origin} zoom={15}>
        {trip.status !== 'in_progress' && <Pin point={trip.origin} type="origin" />}
        <Pin point={trip.dest} type="dest" />
        {trip.status === 'accepted' && <Route coords={trip.pickup_route} color="#111" dashed weight={4} />}
        {trip.status === 'in_progress' && <Route coords={trip.route} />}
        {d && <CarMarker lat={d.lat} lng={d.lng} heading={d.heading} />}
        <FitTo points={trip.status === 'searching' ? [trip.origin] : focus} fitKey={`${trip.status}`} paddingBottom={320} />
      </BaseMap>
      {trip.status === 'searching' && <div className="radar"><span /><span /><span /></div>}
      <div className="top-bar">
        <span className="pill-status"><StatusBadge status={trip.status} /> {trip.code}</span>
        <span className="grow" />
        {trip.status !== 'searching' && <button className="icon-btn" aria-label="Compartir viaje" onClick={share}>{copied ? <Check size={20} /> : <Share2 size={20} />}</button>}
      </div>

      <div className="sheet">
        {trip.status === 'searching' && (
          <div className="stack center" style={{ alignItems: 'center', padding: '6px 0' }}>
            <h2 style={{ margin: 0 }}>Buscando tu {trip.category === 'taxi' ? 'taxi' : 'auto'}…</h2>
            <p className="muted" style={{ margin: 0 }}>Estamos avisando a los conductores más cercanos</p>
            <div className="small muted">{trip.origin.address} → {trip.dest.address} · {fmtMoney(trip.fare_cents)}</div>
            <button className="btn danger block" disabled={cancel.busy} onClick={() => cancel.run()}>Cancelar pedido</button>
          </div>
        )}
        {d && trip.status !== 'searching' && (
          <div className="stack">
            <div className="row between">
              {trip.status === 'arrived'
                ? <div className="eta-bubble">Tu conductor llegó <small>te espera</small></div>
                : <div className="eta-bubble">{trip.eta_min} min <small>{trip.status === 'accepted' ? 'para llegar' : 'al destino'}</small></div>}
              <div style={{ textAlign: 'right' }}><div className="plate">{d.vehicle.plate}</div><div className="xs muted" style={{ marginTop: 3 }}>Móvil {d.vehicle.unit_number}</div></div>
            </div>
            <div className="row">
              <span className="avatar">{initials(d.name)}</span>
              <div className="grow">
                <div className="bold">{d.name}</div>
                <div className="small muted"><Rating value={d.rating} /> · {d.vehicle.brand} {d.vehicle.model} · {d.vehicle.color}</div>
              </div>
            </div>
            {trip.status === 'in_progress' && <div className="small muted">Destino: <b style={{ color: 'var(--text)' }}>{trip.dest.address}</b> · {fmtMoney(trip.fare_cents)} · {PAYMENT[trip.payment_method]}</div>}
            <div className="actions">
              <button className="btn ghost grow" onClick={() => setChat(!chat)}><MessageCircle size={18} /> Mensaje{unread ? ` (${unread})` : ''}</button>
              {d.phone && <a className="btn ghost grow" href={`tel:${d.phone.replace(/[^\d+]/g, '')}`}><Phone size={18} /> Llamar</a>}
              <button className="btn ghost grow" onClick={share}><Share2 size={18} /> {copied ? 'Copiado' : 'Compartir'}</button>
            </div>
            {chat && <Chat trip={trip} messages={messages} refresh={refresh} />}
            {trip.status !== 'in_progress' && <button className="btn danger block sm" disabled={cancel.busy} onClick={() => cancel.run()}><X size={16} /> Cancelar viaje</button>}
          </div>
        )}
      </div>
    </>
  );
}

function Chat({ trip, messages, refresh }) {
  const [text, setText] = useState('');
  const send = async (t) => { if (!t.trim()) return; await api(`/rider/trips/${trip.id}/messages`, { method: 'POST', body: { text: t } }); setText(''); refresh(); };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="chat-box">
        {messages.length === 0 && <div className="small muted center">Escribile al conductor</div>}
        {messages.map((m, i) => <div key={i} className={`msg ${m.sender === 'rider' ? 'me' : 'them'}`}>{m.text}</div>)}
      </div>
      <div className="quick-msgs">{QUICK_MSGS.map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}</div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input placeholder="Mensaje" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="icon-btn flat" aria-label="Enviar"><Send size={18} /></button>
      </form>
    </div>
  );
}

function RateScreen({ trip, refresh }) {
  const [stars, setStars] = useState(5);
  const [tip, setTip] = useState(0);
  const [comment, setComment] = useState('');
  const send = useAsync(async () => { await api(`/rider/trips/${trip.id}/rate`, { method: 'POST', body: { stars, tip_cents: tip, comment } }); refresh(); });
  const d = trip.driver;
  return (
    <div className="screen">
      <div className="screen-body stack" style={{ gap: 16, paddingTop: 40 }}>
        <div className="center stack" style={{ alignItems: 'center', gap: 6 }}>
          <span className="badge good">Llegaste a destino</span>
          <div style={{ fontSize: '2.6rem', fontWeight: 800, letterSpacing: '-.03em' }}>{fmtMoney(trip.fare_cents + tip)}</div>
          <div className="muted small">{PAYMENT[trip.payment_method]} · {fmtKm(trip.distance_m)} · {trip.code}</div>
        </div>
        <div className="card stack" style={{ gap: 6, padding: 16 }}>
          {trip.fare_breakdown.lines?.map((l) => <div key={l.code} className="row between small"><span className="muted">{l.label}</span><span>{fmtMoney(l.cents)}</span></div>)}
          {tip > 0 && <div className="row between small"><span className="muted">Propina</span><span>{fmtMoney(tip)}</span></div>}
          <div className="divider" />
          <div className="row between bold"><span>Total</span><span>{fmtMoney(trip.fare_cents + tip)}</span></div>
        </div>
        <div className="center stack" style={{ alignItems: 'center', gap: 8 }}>
          {d && <span className="avatar">{initials(d.name)}</span>}
          <h3 style={{ margin: 0 }}>¿Cómo estuvo tu viaje con {d?.name.split(' ')[0]}?</h3>
          <Stars value={stars} onChange={setStars} size={36} />
        </div>
        <div>
          <div className="small muted bold" style={{ marginBottom: 8 }}>Agregar propina</div>
          <div className="row wrap" style={{ gap: 8 }}>
            {[0, 50000, 100000, 200000].map((c) => <button key={c} className={`chip ${tip === c ? 'on' : ''}`} onClick={() => setTip(c)}>{c ? fmtMoney(c) : 'Sin propina'}</button>)}
          </div>
        </div>
        <textarea placeholder="Comentario (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <ErrorMsg error={send.error} />
        <button className="btn brand lg block" disabled={send.busy} onClick={() => send.run()}>Enviar calificación</button>
      </div>
    </div>
  );
}

function HistoryScreen({ onBack }) {
  const { data } = usePoll(() => api('/rider/trips'), 15000);
  return (
    <div className="screen">
      <div className="screen-head"><button className="icon-btn flat" aria-label="Volver" onClick={onBack}><ArrowLeft size={20} /></button><h3 style={{ margin: 0 }}>Mis viajes</h3></div>
      <div className="screen-body stack">
        {!data ? <div className="spinner" /> : data.length === 0 ? <p className="muted center">Todavía no hiciste viajes.</p> : data.map((t) => (
          <div key={t.id} className="card" style={{ padding: 14 }}>
            <div className="row between"><span className="small muted">{fmtDateTime(t.requested_at)}</span><StatusBadge status={t.status} /></div>
            <div className="bold ellipsis" style={{ marginTop: 6 }}>{t.dest.address}</div>
            <div className="small muted ellipsis">Desde {t.origin.address}</div>
            <div className="row between" style={{ marginTop: 6 }}>
              <span className="small">{t.driver ? `${t.driver.name} · ${t.driver.vehicle.plate}` : '—'}</span>
              <span className="bold">{fmtMoney(t.fare_cents + (t.tip_cents ?? 0))}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

