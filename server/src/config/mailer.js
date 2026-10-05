const nodemailer = require('nodemailer');

// Locked owner email destination for all OTPs
const OWNER_EMAIL = (process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'admin@example.com').trim();

/**
 * Configure SMTP transporter using environment variables (fallback when HTTP APIs not used)
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();

  if (!user || !pass) {
    return null;
  }

  if (host && host !== 'smtp.gmail.com') {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 6000,
    });
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 6000,
  });
}

/**
 * Sends email via Resend HTTP REST API (Port 443 - HTTPS).
 * Bypasses all cloud firewall/SMTP blocks (e.g. Render, AWS, Heroku).
 * Free tier gives 3,000 emails/month forever with zero credit card.
 */
async function sendViaResend(apiKey, to, subject, html, text) {
  const fromAddress = (process.env.RESEND_FROM || 'TelePhotos Vault <onboarding@resend.dev>').trim();
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [to],
      subject,
      html,
      text,
    }),
    signal: AbortSignal.timeout(8000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Resend API returned HTTP ${response.status}`);
  }

  return data;
}

/**
 * Sends email via Brevo (Sendinblue) HTTP API (Port 443 - HTTPS).
 * Free tier gives 300 emails/day forever.
 */
async function sendViaBrevo(apiKey, to, subject, html, text) {
  const senderEmail = (process.env.BREVO_SENDER || OWNER_EMAIL).trim();

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey.trim(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Telegram Drive Vault', email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
    signal: AbortSignal.timeout(8000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Brevo API returned HTTP ${response.status}`);
  }

  return data;
}

/**
 * Sends a 6-digit OTP code to registered admin email accounts.
 * Priority cascade:
 *  1. Resend API (HTTPS Port 443 - 100% reliable on Render)
 *  2. Brevo API  (HTTPS Port 443 - 100% reliable on Render)
 *  3. Nodemailer SMTP (standard Gmail/SMTP)
 *  4. Console Logging (emergency zero-lockout fallback)
 *
 * @param {string} otp 
 * @returns {Promise<{ sent: boolean, fallback: boolean, provider: string, targetEmail: string, error?: string }>}
 */
async function sendOtpEmail(otp) {
  // Collect all potential owner emails
  const targetEmailList = Array.from(
    new Set(
      [
        (process.env.ADMIN_EMAIL || '').trim(),
        (process.env.SMTP_USER || '').trim(),
      ].filter(Boolean)
    )
  );

  const primaryTarget = targetEmailList[0] || process.env.ADMIN_EMAIL || 'admin@example.com';

  // Always log OTP to server console / Render logs for zero-lockout guarantee
  console.log('\n================================================================');
  console.log('🔐 [TELEGRAM DRIVE] PASSWORD RESET OTP GENERATED');
  console.log('----------------------------------------------------------------');
  console.log(`Target Email(s): ${targetEmailList.join(', ')}`);
  console.log(`One-Time Password (OTP): [ ${otp} ]`);
  console.log('Expires in: 10 minutes');
  console.log('----------------------------------------------------------------');

  const subject = `[Telegram Drive] Password Reset Code: ${otp}`;
  const textContent = `Your Telegram Drive verification code is: ${otp}. It expires in 10 minutes. If you did not request this, you can safely ignore this email.`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; margin: 0; padding: 24px; }
        .container { max-width: 520px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { display: flex; align-items: center; margin-bottom: 24px; }
        .title { font-size: 20px; font-weight: 700; color: #60a5fa; margin: 0; }
        .subtitle { font-size: 14px; color: #9ca3af; margin-top: 4px; }
        .otp-box { background: linear-gradient(135deg, rgba(37,99,235,0.15), rgba(59,130,246,0.05)); border: 1px solid #3b82f6; border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0; }
        .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ffffff; font-family: monospace; }
        .info { font-size: 14px; color: #9ca3af; line-height: 1.6; }
        .warning { font-size: 13px; color: #f59e0b; margin-top: 16px; background-color: rgba(245,158,11,0.1); border-left: 3px solid #f59e0b; padding: 10px 14px; border-radius: 4px; }
        .footer { font-size: 12px; color: #6b7280; text-align: center; margin-top: 32px; border-top: 1px solid #1f2937; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div>
            <h1 class="title">Telegram Drive Vault</h1>
            <p class="subtitle">Security & Access Management</p>
          </div>
        </div>

        <p class="info">Hello,</p>
        <p class="info">A password reset was requested for your Telegram Drive vault. Use the one-time verification code below to authorize the change:</p>

        <div class="otp-box">
          <div class="otp-code">${otp}</div>
        </div>

        <p class="info">This code is valid for <strong>10 minutes</strong> and can only be used once.</p>

        <div class="warning">
          <strong>Security Notice:</strong> If you did not initiate this request, ignore this email. Your current vault password remains unchanged.
        </div>

        <div class="footer">
          Telegram Drive Vault &bull; Zero-Cloud Autonomous Storage
        </div>
      </div>
    </body>
    </html>
  `;

  let delivered = false;
  let deliveredTarget = '';
  let providerUsed = '';
  let lastError = null;

  // 1. Try Resend HTTP API (Recommended: Port 443 HTTPS - never blocked by cloud firewalls)
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  if (resendApiKey) {
    for (const email of targetEmailList) {
      try {
        const resData = await sendViaResend(resendApiKey, email, subject, htmlContent, textContent);
        console.log(`✅ [Resend API] Verification email delivered to ${email} (ID: ${resData.id || 'ok'})`);
        delivered = true;
        deliveredTarget = email;
        providerUsed = 'resend';
        break;
      } catch (err) {
        lastError = err.message;
        console.warn(`⚠️ [Resend API] Delivery to ${email} failed:`, err.message);
      }
    }
  }

  // 2. Try Brevo HTTP API (Port 443 HTTPS)
  if (!delivered) {
    const brevoApiKey = (process.env.BREVO_API_KEY || '').trim();
    if (brevoApiKey) {
      for (const email of targetEmailList) {
        try {
          const resData = await sendViaBrevo(brevoApiKey, email, subject, htmlContent, textContent);
          console.log(`✅ [Brevo API] Verification email delivered to ${email} (ID: ${resData.messageId || 'ok'})`);
          delivered = true;
          deliveredTarget = email;
          providerUsed = 'brevo';
          break;
        } catch (err) {
          lastError = err.message;
          console.warn(`⚠️ [Brevo API] Delivery to ${email} failed:`, err.message);
        }
      }
    }
  }

  // 3. Try standard SMTP Transporter
  if (!delivered) {
    const transporter = createTransporter();
    if (transporter) {
      try {
        const userEmail = process.env.SMTP_USER || 'noreply@telegram-drive.cloud';
        await transporter.sendMail({
          from: `"Telegram Drive Vault" <${userEmail}>`,
          to: primaryTarget,
          subject,
          text: textContent,
          html: htmlContent,
        });
        console.log(`✅ [SMTP] Verification email delivered to: ${primaryTarget}`);
        delivered = true;
        deliveredTarget = primaryTarget;
        providerUsed = 'smtp';
      } catch (err) {
        lastError = err.message;
        console.warn('⚠️ [SMTP] Outbound email delivery failed:', err.message);
      }
    }
  }

  if (delivered) {
    console.log('================================================================\n');
    return { sent: true, fallback: false, provider: providerUsed, targetEmail: deliveredTarget };
  }

  // 4. Safe Console Backup
  console.log('💡 Master Admin Key or the OTP logged above can be used to reset immediately.');
  console.log('================================================================\n');
  return { sent: false, fallback: true, provider: 'console', targetEmail: primaryTarget, error: lastError };
}

module.exports = {
  OWNER_EMAIL,
  sendOtpEmail,
};

