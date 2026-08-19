import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './App';
import { initAnalytics } from './engine/analytics';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

initAnalytics();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
