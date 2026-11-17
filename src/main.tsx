import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/theme/app.css';
import { useGame } from './store/game';
import { setupInstall } from './platform/device';

setupInstall();

// Test hook for automated browser checks (?debug).
if (import.meta.env.DEV || location.search.includes('debug')) (window as unknown as { __vals: typeof useGame }).__vals = useGame;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
