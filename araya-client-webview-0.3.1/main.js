
require('dotenv').config();
const { app, BrowserWindow, session, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const { openGoogleAuth } = require('./oauth');

const START_URL = 'https://chat.openai.com/';
const LIMIT_DEFAULT = 50;
let limit = LIMIT_DEFAULT;

function isOauthUrl(u) {
  try {
    const h = new URL(u).hostname;
    return new Set(['accounts.google.com','login.microsoftonline.com','appleid.apple.com','id.apple.com']).has(h);
  } catch { return false; }
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Araya Client WebView',
    backgroundColor: '#111111',
    webPreferences: {
      partition: 'persist:araya',
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  win.webContents.setUserAgent(ua);

  const ses = session.fromPartition('persist:araya');
  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    const block = ['googletagmanager.com','google-analytics.com','doubleclick.net','segment.io','fullstory.com'].some(d => url.includes(d));
    callback({ cancel: block });
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isOauthUrl(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (isOauthUrl(url)) { e.preventDefault(); shell.openExternal(url); }
  });

  const template = [
    {
      label: 'Araya',
      submenu: [
        { role: 'reload', label: 'Перезагрузить' },
        { role: 'toggleDevTools', label: 'Открыть DevTools' },
        { type: 'separator' },
        { label: 'Войти через Google', click: async () => {
            try {
              const tokens = await openGoogleAuth();
              win.webContents.send('araya:oauthResult', { ok: true, tokens });
            } catch (e) {
              win.webContents.send('araya:oauthResult', { ok: false, error: String(e?.message || e) });
            }
          }
        },
        { type: 'separator' },
        { label: 'Показать больше сообщений', click: () => { limit += 50; win.webContents.send('araya:setLimit', limit); } },
        { label: 'Сбросить лимит (50)', click: () => { limit = LIMIT_DEFAULT; win.webContents.send('araya:setLimit', limit); } },
        { type: 'separator' },
        { label: 'Открыть ChatGPT в браузере', click: () => shell.openExternal(START_URL) },
        { type: 'separator' },
        { role: 'quit', label: 'Выход' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  win.loadURL(START_URL);
}

ipcMain.handle('oauth:google', async () => {
  const tokens = await openGoogleAuth();
  return tokens;
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
