import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles.css';
import Landing from './Landing';
import RiderApp from './rider/RiderApp';
import DriverApp from './driver/DriverApp';
import AdminApp from './admin/AdminApp';
import TrackPage from './TrackPage';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pasajero/*" element={<RiderApp />} />
        <Route path="/conductor/*" element={<DriverApp />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/viaje/:token" element={<TrackPage />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
