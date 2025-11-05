require('dotenv').config();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

const { app, BrowserWindow, session, Menu, shell } = require('electron');
const path = require('path');
const urlLib = require('url');

const START_URL = 'https://chat.openai.com/';

const LIMIT_DEFAULT = 50; // последние N сообщений
let limit = LIMIT_DEFAULT;

// домены внешних OAuth-провайдеров, которые нельзя открывать во встраиваемом браузере
const OAUTH_HOSTS = new Set([
  'accounts.google.com',
  'login.microsoftonline.com',
  'appleid.apple.com',
  'id.apple.com',
  'auth0.openai.com' // если появятся всплывающие окна авторизации
]);

function isOauthUrl(u) {
  try {
    const h = new URL(u).hostname;
    return OAUTH_HOSTS.has(h);
  } catch { return false; }
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Araya Client WebView',
    backgroundColor: '#111111',
    webPreferences: {
      // отдельное постоянное хранилище сессии — чтобы не разлогинивало между запусками
      partition: 'persist:araya',
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Современный user-agent — чтобы ChatGPT работал как в Chrome
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  win.webContents.setUserAgent(ua);

  // Вырезаем трекеры — экономит ресурсы, не ломая чат
  const ses = session.fromPartition('persist:araya');
  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    const block = [
      'googletagmanager.com', 'google-analytics.com',
      'doubleclick.net', 'segment.io', 'fullstory.com'
    ].some(d => url.includes(d));
    callback({ cancel: block });
  });

  // Внешний OAuth — только в системном браузере
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isOauthUrl(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (isOauthUrl(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // Простое меню
  const template = [
    {
      label: 'Araya',
      submenu: [
        { role: 'reload', label: 'Перезагрузить' },
        { role: 'toggleDevTools', label: 'Открыть DevTools' },
        { type: 'separator' },
        {
          label: 'Показать больше сообщений',
          click: () => { limit += 50; win.webContents.send('araya:setLimit', limit); }
        },
        {
          label: 'Сбросить лимит (50)',
          click: () => { limit = LIMIT_DEFAULT; win.webContents.send('araya:setLimit', limit); }
        },
        { type: 'separator' },
        {
          label: 'Открыть ChatGPT в системном браузере',
          click: () => shell.openExternal(START_URL)
        },
        { type: 'separator' },
        { role: 'quit', label: 'Выход' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  win.loadURL(START_URL);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
