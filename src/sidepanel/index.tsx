import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

const SidePanel = () => {
  return (
    <div className="sidepanel-container">
      <h1>Browser Sidebar</h1>
      <p>Side panel placeholder</p>
    </div>
  );
};

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SidePanel />
    </React.StrictMode>
  );
}
