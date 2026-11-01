import "@ui5/webcomponents-icons/dist/menu.js";
import "@ui5/webcomponents/dist/Tag.js";
import "@ui5/webcomponents/dist/Card.js";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "@ui5/webcomponents/dist/Assets.js";
import "@ui5/webcomponents-fiori/dist/Assets.js";
import { setTheme } from "@ui5/webcomponents-base/dist/config/Theme.js";
import './styles/tokens.css'
import './index.css'
import App from './App.tsx'

setTheme("sap_horizon");

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)