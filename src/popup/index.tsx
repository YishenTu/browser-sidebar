import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

const Popup = () => {
  return (
    <div className="popup-container">
      <h1>Browser Sidebar</h1>
      <p>Popup placeholder</p>
    </div>
  );
};

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  );
}
