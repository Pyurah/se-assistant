import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@app/App';
import { logger } from '@core/logger';
import '@ui/styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

logger.info('booting se-assistant', {
  mode: import.meta.env.MODE,
});

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
