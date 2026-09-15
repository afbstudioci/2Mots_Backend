// src/utils/emailService.js
// SERVICE D'ENVOI D'EMAILS TRANSITIONNELS VIA BREVO REST API (HTTPS 443)
// Standard : Bank Grade (Strict <= 270 lignes, Sans Emojis)

const axios = require('axios');

/**
 * Envoie un email contenant le code OTP de réinitialisation via l'API REST Brevo
 * @param {string} to - Adresse email du destinataire
 * @param {string} otp - Code OTP à 6 chiffres
 */
const sendOtpEmail = async (to, otp) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('[BREVO REST ERROR] Variable BREVO_API_KEY manquante dans l\'environnement.');
    throw new Error('Configuration du service email manquante.');
  }

  const senderEmail = process.env.EMAIL_FROM || 'contact2mots@gmail.com';
  const senderName = '2Mots Sécurité';

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Réinitialisation de mot de passe - 2Mots</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1A202C; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1A202C; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #242B3A; border-radius: 20px; border: 1px solid #2D3748; overflow: hidden; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 36px 24px 20px 24px;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #FF7F50; letter-spacing: 2px;">2MOTS</h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #A0AEC0; font-weight: 500;">Sécurité du compte</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 10px 32px 30px 32px; text-align: center;">
              <h2 style="margin: 0 0 14px 0; font-size: 19px; font-weight: 700; color: #F7F5F0;">
                Réinitialisation de votre mot de passe
              </h2>
              <p style="margin: 0 0 28px 0; font-size: 14px; line-height: 22px; color: #CBD5E0;">
                Vous avez demandé la réinitialisation de votre mot de passe. Voici votre code de validation temporaire :
              </p>

              <!-- OTP Box -->
              <table align="center" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 28px auto;">
                <tr>
                  <td align="center" style="background-color: #1A202C; border: 2px solid #FF7F50; border-radius: 14px; padding: 16px 32px;">
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #FF7F50; display: block; margin-left: 10px;">
                      ${otp}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Expiration Notice -->
              <p style="margin: 0 0 12px 0; font-size: 12px; line-height: 18px; color: #A0AEC0;">
                Ce code est strictement confidentiel et expire dans <strong>15 minutes</strong>.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 16px; color: #718096;">
                Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #1A202C; padding: 18px 24px; border-top: 1px solid #2D3748;">
              <p style="margin: 0; font-size: 11px; color: #718096;">
                © ${new Date().getFullYear()} 2Mots. Tous droits réservés.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          email: senderEmail,
          name: senderName,
        },
        to: [{ email: to }],
        subject: `Code de sécurité 2Mots : ${otp}`,
        htmlContent: htmlContent,
      },
      {
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        timeout: 10000,
      }
    );
    return true;
  } catch (error) {
    const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error('[BREVO REST ERROR] Échec de l\'envoi de l\'email OTP :', errorDetails);
    throw new Error('Échec de l\'envoi de l\'email de réinitialisation.');
  }
};

module.exports = {
  sendOtpEmail,
};
