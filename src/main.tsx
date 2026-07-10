import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Toasts } from './components/Toast';
import { DialogHost } from './components/dialogs';
import { applyCachedTheme } from './lib/theme';
import './index.css';

applyCachedTheme();

if (import.meta.env.DEV) {
  import('./lib/seed-demo').then(({ seedDemo }) => {
    (window as any).seedDemo = seedDemo;
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toasts />
    <DialogHost />
  </StrictMode>
);
