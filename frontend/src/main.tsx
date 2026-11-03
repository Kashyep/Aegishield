import './ui5';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "@ui5/webcomponents/dist/Assets.js";
import "@ui5/webcomponents-fiori/dist/Assets.js";
import { setTheme } from "@ui5/webcomponents-base/dist/config/Theme.js";
import './styles/tokens.css'
import './index.css'
import App from './App.tsx'
const savedTheme = (typeof window !== 'undefined' && localStorage.getItem('aegis.theme')) || 'sap_horizon';
setTheme(savedTheme);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)