import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {KioskDisplay} from './components/KioskDisplay.tsx';
import { RateCardPage } from './components/RateCardPage.tsx';
import './index.css';

// Every physical TV/display opens this exact same fixed path — no device ID,
// no business ID, nothing identifying in the URL at all. The screen itself
// mints and remembers its own pairing code (see KioskDisplay). Everyone else
// (staff managing content) gets the normal admin dashboard.
const path = window.location.pathname.replace(/\/+$/, '');
const isKiosk = path === '/tv';
// Public advertising rate card: intentionally rendered outside AuthProvider,
// so the page works before login and during a signed-in session.
const isRateCard = path === '/rate-card';
// A separate, unlisted entrance for platform administrators — still
// requires a real login, and still checks the account's actual role from
// Firestore before showing anything (this route grants no privilege by
// itself, it's just a different landing screen for people who already have
// Super Admin access).
const isAdminEntrance = path === '/willgax';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isKiosk ? <KioskDisplay /> : isRateCard ? <RateCardPage /> : <App isAdminEntrance={isAdminEntrance} />}
  </StrictMode>,
);
