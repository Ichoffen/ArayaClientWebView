const { shell } = require('electron');
const http = require('http');
const url = require('url');
const querystring = require('querystring');
const fetch = require('node-fetch');
require('dotenv').config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:5190'; // можно другой порт, если занят

async function openGoogleAuth() {
  return new Promise((resolve, reject) => {
    const authUrl =
      'https://accounts.google.com/o/oauth2/v2/auth?' +
      querystring.stringify({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'email profile openid',
        access_type: 'offline',
        prompt: 'consent'
      });

    // открываем Google во внешнем браузере
    shell.openExternal(authUrl);

    // ждём код от Google
    const server = http.createServer(async (req, res) => {
      const query = url.parse(req.url, true).query;
      const code = query.code;

      if (!code) {
        res.end('Не удалось получить код авторизации.');
        return;
      }

      res.end('Авторизация завершена, можно закрыть вкладку.');
      server.close();

      // обмениваем код на токен
      try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
          })
        });

        const tokens = await tokenResponse.json();
        resolve(tokens);
      } catch (err) {
        reject(err);
      }
    });

    server.listen(5190, () => {
      console.log('✅ OAuth server running on http://localhost:5190');
    });
  });
}

module.exports = { openGoogleAuth };
