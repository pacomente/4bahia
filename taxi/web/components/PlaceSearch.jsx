import { useEffect, useRef, useState } from 'react';
import { MapPin, Search, Navigation, Map as MapIcon, Clock } from 'lucide-react';

let placesCache = null;
export function usePlaces() {
  const [places, setPlaces] = useState(placesCache ?? []);
  useEffect(() => {
    if (placesCache) return;
    fetch('/api/public/places').then((r) => r.json()).then((p) => { placesCache = p; setPlaces(p); }).catch(() => {});
  }, []);
  return places;
}

// Búsqueda de direcciones: lugares populares + OpenStreetMap (Nominatim) acotado a la ciudad.
export default function PlaceSearch({ center, city, onPick, onPickOnMap, onUseMyLocation, placeholder = '¿A dónde vamos?', autoFocus = true, recent = [] }) {
  const places = usePlaces();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 3) { setResults([]); return undefined; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const d = 0.25;
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=ar&accept-language=es&bounded=1&viewbox=${center.lng - d},${center.lat + d},${center.lng + d},${center.lat - d}&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        setResults(data.map((r) => ({ name: r.display_name.split(',').slice(0, 2).join(','), address: r.display_name.split(',').slice(2, 4).join(',').trim() || city, lat: Number(r.lat), lng: Number(r.lon) })));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer.current);
  }, [q, center.lat, center.lng, city]);

  const local = q ? places.filter((p) => `${p.name} ${p.address}`.toLowerCase().includes(q.toLowerCase())) : places;
  const Row = ({ p, icon: Icon = MapPin }) => (
    <button type="button" className="place-row" onClick={() => onPick({ lat: p.lat, lng: p.lng, address: p.name })}>
      <span className="ic"><Icon size={18} /></span>
      <span className="grow"><div className="bold ellipsis">{p.name}</div><div className="small muted ellipsis">{p.address}</div></span>
    </button>
  );

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div style={{ position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--text-3)' }} />
        <input autoFocus={autoFocus} placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 42, fontSize: '1rem' }} />
      </div>
      {onUseMyLocation && (
        <button type="button" className="place-row" onClick={onUseMyLocation}>
          <span className="ic" style={{ background: '#e8effd', color: '#2563eb' }}><Navigation size={18} /></span>
          <span className="bold">Usar mi ubicación actual</span>
        </button>
      )}
      {onPickOnMap && (
        <button type="button" className="place-row" onClick={onPickOnMap}>
          <span className="ic"><MapIcon size={18} /></span>
          <span className="bold">Elegir en el mapa</span>
        </button>
      )}
      {loading && <div className="small muted" style={{ padding: 8 }}>Buscando…</div>}
      {results.map((p, i) => <Row key={`r${i}`} p={p} />)}
      {!q && recent.length > 0 && <div className="xs muted bold" style={{ padding: '10px 4px 0', textTransform: 'uppercase', letterSpacing: '.08em' }}>Recientes</div>}
      {!q && recent.map((p, i) => <Row key={`h${i}`} p={p} icon={Clock} />)}
      <div className="xs muted bold" style={{ padding: '10px 4px 0', textTransform: 'uppercase', letterSpacing: '.08em' }}>Lugares populares</div>
      {local.map((p) => <Row key={p.name} p={p} />)}
    </div>
  );
}
