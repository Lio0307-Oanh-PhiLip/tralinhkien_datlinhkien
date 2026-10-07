import './consoleStub';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary fallbackTitle="Đã xảy ra sự cố giao diện">
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

