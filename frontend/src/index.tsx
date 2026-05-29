import './utils/toast'; // Override window.alert as early as possible
import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Failed to find root element");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
