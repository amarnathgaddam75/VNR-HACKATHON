import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { WardProvider } from './store/WardContext.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WardProvider>
      <App />
    </WardProvider>
  </StrictMode>,
);
