const nodemailer = require('nodemailer');

/**
 * Configure SMTP transporter using environment variables.
 * Compatible with Gmail (using App Passwords), Brevo, Resend, Mailgun, or any standard SMTP.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();

  if (!user || !pass) {
    return null; // Not configured yet
  }

  // If a custom non-Gmail SMTP host is specified
  if (host && host !== 'smtp.gmail.com') {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 7000,
      greetingTimeout: 7000,
      socketTimeout: 10000,
    });
  }

  // Default: Use official 'gmail' service with strict timeouts to prevent hanging on cloud hosts
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 10000,
  });
}

// Locked owner email destination for all OTPs
const OWNER_EMAIL = (process.env.ADMIN_EMAIL || 'surajchandan09@gmail.com').trim();

/**
 * Sends a 6-digit OTP code strictly to the owner's authorized email (surajchandan09@gmail.com).
 * If SMTP credentials are not yet configured or blocked by cloud firewall, falls back to logging the OTP in the console.
 * @param {string} otp 
 * @returns {Promise<{ sent: boolean, fallback: boolean, targetEmail: string, error?: string }>}
 */
async function sendOtpEmail(otp) {
  const targetEmail = OWNER_EMAIL;
  const transporter = createTransporter();

  // Always log OTP to server console for high-availability backup
  console.log('\n================================================================');
  console.log('🔐 [TELEGRAM DRIVE] PASSWORD RESET OTP GENERATED');
  console.log('----------------------------------------------------------------');
  console.log(`Locked Owner Email: ${targetEmail}`);
  console.log(`One-Time Password (OTP): [ ${otp} ]`);
  console.log('Expires in: 10 minutes');
  console.log('----------------------------------------------------------------');

  if (!transporter) {
    console.log('Notice: SMTP credentials not set in environment. Use Master Admin Key or the OTP above.');
    console.log('================================================================\n');
    return { sent: false, fallback: true, targetEmail, reason: 'unconfigured' };
  }

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

  try {
    const userEmail = process.env.SMTP_USER || 'noreply@telegram-drive.cloud';
    await transporter.sendMail({
      from: `"Telegram Drive Vault" <${userEmail}>`,
      to: targetEmail,
      subject: `[Telegram Drive] Password Reset Code: ${otp}`,
      text: `Your Telegram Drive verification code is: ${otp}. It expires in 10 minutes.`,
      html: htmlContent,
    });
    console.log('✅ Real verification email delivered successfully to:', targetEmail);
    console.log('================================================================\n');
    return { sent: true, fallback: false, targetEmail };
  } catch (err) {
    console.warn('⚠️ SMTP outbound email delivery notice:', err.message);
    console.log('💡 Backup: OTP [ ' + otp + ' ] is recorded in active memory & database.');
    console.log('================================================================\n');
    return { sent: false, fallback: true, targetEmail, error: err.message };
  }
}

module.exports = {
  OWNER_EMAIL,
  sendOtpEmail,
};
