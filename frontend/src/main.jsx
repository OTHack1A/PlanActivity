// Application entry point: mounts <App> into #root, wrapped in the i18n provider
// so every component can call useI18n(). StrictMode surfaces unsafe patterns in dev.
import React from 'react'
import ReactDOM from 'react-dom/client'
import './app.css'
import App from './App.jsx'
import { I18nProvider } from './i18n.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* I18nProvider supplies the t() translator and current language to the tree */}
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
)
