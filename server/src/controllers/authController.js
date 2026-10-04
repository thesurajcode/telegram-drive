const { MASTER_PASSWORD, VALID_TOKEN } = require('../middleware/auth');

/**
 * Validates master password and returns authorization session token
 */
function login(req, res) {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  if (password === MASTER_PASSWORD) {
    return res.status(200).json({
      success: true,
      token: VALID_TOKEN,
      message: 'Access granted. Welcome to your Telegram Drive vault.',
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Incorrect password. Access denied.',
  });
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

module.exports = {
  login,
  verify,
};
