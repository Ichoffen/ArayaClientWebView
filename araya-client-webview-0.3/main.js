
const { app, BrowserWindow, session, Menu } = require('electron');
const path = require('path');

const START_URL = 'https://chat.openai.com/';

const LIMIT_DEFAULT = 50; // показывать последние N сообщений
let limit = LIMIT_DEFAULT;

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Araya Client WebView',
    backgroundColor: '#111111',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Современный user-agent, чтобы чат открылся как в Chrome
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  win.webContents.setUserAgent(ua);

  // Блокируем тяжелые трекеры/аналитику, не влияющие на чат
  const ses = session.defaultSession;
  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    const block = [
      'googletagmanager.com', 'google-analytics.com',
      'doubleclick.net', 'segment.io', 'fullstory.com'
    ].some(domain => url.includes(domain));
    callback({ cancel: block });
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
          click: () => {
            limit += 50;
            win.webContents.send('araya:setLimit', limit);
          }
        },
        {
          label: 'Сбросить лимит (50)',
          click: () => {
            limit = LIMIT_DEFAULT;
            win.webContents.send('araya:setLimit', limit);
          }
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
