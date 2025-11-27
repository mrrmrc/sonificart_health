import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Ora funzionerà perché App.tsx è nella stessa cartella src/
import { LanguageProvider } from './contexts/LanguageContext';
import './index.css'; // Ora funzionerà perché index.css è in src/

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <LanguageProvider>
            <App />
        </LanguageProvider>
    </React.StrictMode>
);