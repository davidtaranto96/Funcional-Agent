/**
 * Script de una sola vez para obtener el Google Refresh Token.
 *
 * Pasos previos en Google Cloud Console:
 *   1. Ir a APIs & Services → Credenciales → tu OAuth 2.0 Client ID
 *   2. En "URIs de redirección autorizados" agregar: http://localhost:3001/callback
 *   3. Guardar cambios
 *
 * Cómo usarlo:
 *   node scripts/get-google-token.js
 *
 * Una vez obtenido el token, agregarlo a .env y a Railway:
 *   GOOGLE_REFRESH_TOKEN=<el token que aparece en la terminal>
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { google } = require('googleapis');
const http = require('http');
const { URL } = require('url');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const REDIRECT = 'http://localhost:3001/callback';

async function main() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('\n❌ Faltan variables de entorno:');
    if (!process.env.GOOGLE_CLIENT_ID) console.error('   GOOGLE_CLIENT_ID no encontrado en .env');
    if (!process.env.GOOGLE_CLIENT_SECRET) console.error('   GOOGLE_CLIENT_SECRET no encontrado en .env');
    console.error('\nAsegurate de tener estas variables en tu .env antes de correr este script.\n');
    process.exit(1);
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT,
  );

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // fuerza que Google devuelva el refresh token
  });

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   Obtener Google Calendar Refresh Token          ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
  console.log('Paso 1: Verificá que en Google Cloud Console tengas configurado:');
  console.log(`   Authorized redirect URI: ${REDIRECT}\n`);
  console.log('Paso 2: Abrí este link en tu navegador:\n');
  console.log(`   ${authUrl}\n`);
  console.log('Paso 3: Autorizá con tu cuenta de Google y volvé acá.\n');
  console.log('Esperando la autorización...\n');

  await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url || !req.url.startsWith('/callback')) {
        res.end('Esperando callback de Google...');
        return;
      }

      const params = new URL(req.url, 'http://localhost:3001').searchParams;
      const code = params.get('code');
      const error = params.get('error');

      if (error || !code) {
        const msg = error || 'No se recibió el código de autorización';
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h2>Error: ${msg}</h2><p>Cerrá esta ventana e intentá de nuevo.</p>`);
        server.close();
        reject(new Error(msg));
        return;
      }

      try {
        const { tokens } = await client.getToken(code);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <h1 style="color:green">✅ Autorizado correctamente</h1>
          <p>Ya podés cerrar esta ventana y volver a la terminal.</p>
        `);
        server.close();

        console.log('✅ ¡Token obtenido correctamente!\n');
        console.log('──────────────────────────────────────────────────');
        console.log('Agregá esta línea a tu .env:');
        console.log('');
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token || '(vacío — ver nota abajo)'}`);
        console.log('');
        console.log('Y también en Railway → Variables de entorno.');
        console.log('──────────────────────────────────────────────────');

        if (!tokens.refresh_token) {
          console.log('\n⚠️  El refresh token salió vacío. Esto pasa cuando ya autorizaste');
          console.log('   esta app antes. Para regenerarlo:');
          console.log('   1. Ir a https://myaccount.google.com/permissions');
          console.log('   2. Buscar tu app y revocar el acceso');
          console.log('   3. Volver a correr este script\n');
        }

        resolve();
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h2>Error: ${err.message}</h2>`);
        server.close();
        reject(err);
      }
    });

    server.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ El puerto 3001 ya está en uso. Cerrá lo que esté corriendo ahí e intentá de nuevo.\n`);
      }
      reject(err);
    });

    server.listen(3001, () => {
      console.log(`Servidor local corriendo en http://localhost:3001\n`);
    });
  });
}

main().catch(err => {
  console.error('\n❌ Error:', err.message, '\n');
  process.exit(1);
});
