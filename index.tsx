import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Try to find a custom embed container first, otherwise use 'root'
const rootElement = document.getElementById('cubebot-embed') || document.getElementById('root');

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);