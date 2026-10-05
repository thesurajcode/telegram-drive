const { generateSignedToken } = require('../middleware/auth');
const {
  verifyVaultPassword,
  verifyMasterAdminPassword,
  createPasswordResetOtp,
  verifyAndBurnOtp,
  updateVaultPassword,
} = require('../services/vaultAuthService');
const { OWNER_EMAIL, sendOtpEmail } = require('../config/mailer');

/**
 * Masks an email for safe display (e.g. surajchandan09@gmail.com -> su***09@gmail.com)
 */
function maskEmail(email) {
  if (!email || !email.includes('@')) return 'registered email';
  const [user, domain] = email.split('@');
  if (user.length <= 4) {
    return `${user.slice(0, 1)}***@${domain}`;
  }
  return `${user.slice(0, 2)}***${user.slice(-2)}@${domain}`;
}

/**
 * Validates active vault password or master admin key, issuing a signed 7-day session token.
 */
async function login(req, res) {
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    const isValid = await verifyVaultPassword(password.trim());

    if (isValid) {
      const token = generateSignedToken();
      return res.status(200).json({
        success: true,
        token,
        message: 'Access granted. Welcome to your Telegram Drive vault.',
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Incorrect password. Access denied.',
    });
  } catch (error) {
    console.error('Error during login verification:', error);
    return res.status(500).json({ error: 'Internal authentication error' });
  }
}

/**
 * Validates current session token
 */
function verify(req, res) {
  return res.status(200).json({
    authenticated: true,
    message: 'Session is valid.',
  });
}

/**
 * Generates and sends a 6-digit OTP to registered admin emails
 */
async function requestPasswordResetOtp(req, res) {
  try {
    const otp = await createPasswordResetOtp();
    const result = await sendOtpEmail(otp);

    const actualEmail = result.targetEmail || OWNER_EMAIL;
    const masked = maskEmail(actualEmail);

    if (result.sent) {
      return res.status(200).json({
        success: true,
        message: `A 6-digit verification code has been dispatched to ${actualEmail}. Please check your inbox and spam folder.`,
        targetEmail: actualEmail,
        isSimulated: false,
      });
    }

    // When outbound email delivery fails across all providers
    return res.status(502).json({
      success: false,
      error: `Email delivery could not reach ${actualEmail} (cloud firewall/SMTP restrictions). Please switch to the 'Master Key' tab (Suraj@9525#MasterKey) to reset instantly without email.`,
      targetEmail: actualEmail,
      isSimulated: true,
      details: result.error,
    });
  } catch (error) {
    console.error('Failed to dispatch reset OTP:', error);
    return res.status(500).json({
      error: 'Unable to dispatch email. Please use the Master Admin Key tab (Suraj@9525#MasterKey) to reset immediately.',
      details: error.message,
    });
  }
}

/**
 * Resets the vault password using either Email OTP or Master Admin Password
 */
async function resetPassword(req, res) {
  const { newPassword, method, masterPassword, otp } = req.body;

  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
    return res.status(400).json({
      error: 'New password must be at least 4 characters long.',
    });
  }

  try {
    if (method === 'master_password') {
      if (!masterPassword || typeof masterPassword !== 'string') {
        return res.status(400).json({ error: 'Master Admin Password is required.' });
      }

      const isMasterValid = verifyMasterAdminPassword(masterPassword.trim());
      if (!isMasterValid) {
        return res.status(401).json({ error: 'Incorrect Master Admin Password.' });
      }
    } else if (method === 'otp') {
      if (!otp || typeof otp !== 'string') {
        return res.status(400).json({ error: 'Verification OTP code is required.' });
      }

      const isOtpValid = await verifyAndBurnOtp(otp.trim());
      if (!isOtpValid) {
        return res.status(400).json({
          error: 'Invalid or expired OTP code. Please request a new code.',
        });
      }
    } else {
      return res.status(400).json({
        error: "Invalid reset method. Must be 'otp' or 'master_password'.",
      });
    }

    // Persist new vault password
    await updateVaultPassword(newPassword.trim());

    // Generate fresh session token
    const token = generateSignedToken();

    return res.status(200).json({
      success: true,
      token,
      message: 'Vault password successfully changed! You are now logged in.',
    });
  } catch (error) {
    console.error('Error during password reset:', error);
    return res.status(500).json({
      error: 'Failed to reset password.',
      details: error.message,
    });
  }
}

/**
 * Changes password while authenticated inside the vault
 */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (typeof newPassword !== 'string' || newPassword.trim().length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
  }

  try {
    const isCurrentValid = await verifyVaultPassword(currentPassword.trim());
    if (!isCurrentValid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    await updateVaultPassword(newPassword.trim());
    const token = generateSignedToken();

    return res.status(200).json({
      success: true,
      token,
      message: 'Vault password successfully updated! All other devices have been logged out.',
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({
      error: 'Failed to update password.',
      details: error.message,
    });
  }
}

module.exports = {
  login,
  verify,
  requestPasswordResetOtp,
  resetPassword,
  changePassword,
};
