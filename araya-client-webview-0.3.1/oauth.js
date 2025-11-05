
const { shell } = require('electron');
const http = require('http');
const url = require('url');
const fetch = require('node-fetch');
require('dotenv').config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://localhost:5190';

function ensureCreds() {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Нет GOOGLE_CLIENT_ID или GOOGLE_CLIENT_SECRET в .env');
}

async function openGoogleAuth() {
  ensureCreds();
  return new Promise((resolve, reject) => {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'email profile openid');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    shell.openExternal(authUrl.toString());

    const server = http.createServer(async (req, res) => {
      try {
        const q = url.parse(req.url, true).query;
        const code = q.code;
        if (!code) { res.end('Нет кода авторизации'); return; }
        res.end('Авторизация завершена — это окно можно закрыть.');
        server.close();

        const body = new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code'
        });

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });

        const tokens = await tokenResponse.json();
        resolve(tokens);
      } catch (e) {
        reject(e);
      }
    });
    server.listen(5190, () => console.log('OAuth local server: http://localhost:5190'));
  });
}

module.exports = { openGoogleAuth };
