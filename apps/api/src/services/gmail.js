const { google } = require('googleapis');

const OAuth2 = google.auth.OAuth2;

async function enviarBienvenida({ nombre, email, password, rol }) {
  const oauth2Client = new OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
  });

  // Instanciar el cliente de Gmail API oficial
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Construir cuerpo del correo en formato RFC 2822
  const encabezados = [
    `From: "MaquilaControl" <${process.env.GMAIL_USER}>`,
    `To: ${email}`,
    'Subject: Bienvenido a MaquilaControl',
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:2rem;border:1px solid #e2e8f0;border-radius:8px;">`,
    `  <h2 style="color:#1e293b;">Bienvenido a MaquilaControl</h2>`,
    `  <p>Hola <strong>${nombre}</strong>, tu cuenta ha sido creada exitosamente.</p>`,
    `  <div style="background:#f8fafc;padding:1rem;border-radius:6px;margin:1rem 0;">`,
    `    <p style="margin:0.3rem 0;"><strong>Correo:</strong> ${email}</p>`,
    `    <p style="margin:0.3rem 0;"><strong>Contraseña temporal:</strong> ${password}</p>`,
    `    <p style="margin:0.3rem 0;"><strong>Rol:</strong> ${rol}</p>`,
    `  </div>`,
    `  <p>Ingresa en: <a href="https://dwi-proyecto.vercel.app">dwi-proyecto.vercel.app</a></p>`,
    `  <p style="color:#64748b;font-size:0.85rem;">Cambia tu contraseña después de tu primer inicio de sesión.</p>`,
    `</div>`
  ].join('\r\n');

  // Codificar en Base64 URL Safe para la API de Google
  const rawBase64 = Buffer.from(encabezados)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Enviar usando la API HTTP REST pura de Gmail
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: rawBase64,
    },
  });
}

module.exports = { enviarBienvenida };
