import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CSWidget } from './widget';

createRoot(document.getElementById('cs-widget-root')!).render(
  <StrictMode>
    <CSWidget />
  </StrictMode>,
);
