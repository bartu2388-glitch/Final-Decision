const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // Geliştirme aşamasında Vite'in çalıştığı adresi açar
  win.loadURL('http://localhost:5173'); 
}

app.whenReady().then(createWindow);
