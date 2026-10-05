const fs = require('fs');
const path = require('path');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

let clientInstance = null;

/**
 * Saves the current session string to .env file if not already present
 * and logs it to the terminal for easy backup.
 * @param {TelegramClient} client 
 * @returns {string} The saved session string
 */
function exportSessionString(client) {
  if (!client || !client.session) {
    throw new Error('Telegram client is not initialized');
  }

  const sessionString = client.session.save();

  const maskedString = sessionString.length > 20
    ? `${sessionString.slice(0, 10)}...[SECURELY MASKED]...${sessionString.slice(-6)}`
    : '[MASKED]';

  if (process.env.NODE_ENV !== 'production') {
    console.log('\n================================================================');
    console.log('📌 TELEGRAM SESSION STRING INITIALIZED');
    console.log('----------------------------------------------------------------');
    console.log(`Preview: ${maskedString}`);
    console.log('----------------------------------------------------------------');
    console.log('Automatically persisted into your server/.env as TELEGRAM_SESSION_STRING');
    console.log('================================================================\n');
  } else {
    console.log('✅ Telegram session initialized and persisted.');
  }

  // Attempt to automatically save into .env if empty
  try {
    const envPath = path.resolve(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('TELEGRAM_SESSION_STRING=')) {
        const regex = /^TELEGRAM_SESSION_STRING=(.*)$/m;
        const match = envContent.match(regex);
        if (match && !match[1].trim()) {
          envContent = envContent.replace(
            /^TELEGRAM_SESSION_STRING=.*$/m,
            `TELEGRAM_SESSION_STRING=${sessionString}`
          );
          fs.writeFileSync(envPath, envContent, 'utf8');
          console.log('✅ TELEGRAM_SESSION_STRING automatically saved to .env file');
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Could not automatically update .env file:', err.message);
  }

  return sessionString;
}

/**
 * Initializes and connects the GramJS TelegramClient using bot credentials
 * or an existing StringSession.
 * @returns {Promise<TelegramClient>}
 */
async function initTelegramClient() {
  if (clientInstance && clientInstance.connected) {
    return clientInstance;
  }

  const apiId = parseInt(process.env.TELEGRAM_API_ID, 10);
  const apiHash = process.env.TELEGRAM_API_HASH;
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();

  if (!apiId || !apiHash) {
    throw new Error(
      'TELEGRAM_API_ID and TELEGRAM_API_HASH must be configured in your .env file.'
    );
  }

  // Sanitize session string: strip surrounding quotes, whitespace, and placeholder values
  let rawSession = (process.env.TELEGRAM_SESSION_STRING || '').trim();
  let sessionString = rawSession.replace(/^["']|["']$/g, '').trim();
  const lowerSession = sessionString.toLowerCase();
  if (
    !sessionString ||
    lowerSession === 'undefined' ||
    lowerSession === 'null' ||
    lowerSession === 'none' ||
    lowerSession === 'false' ||
    lowerSession.includes('your_') ||
    lowerSession.includes('placeholder')
  ) {
    sessionString = '';
  }

  // GramJS StringSession v1 format must start with '1' and have sufficient length
  if (sessionString && (!sessionString.startsWith('1') || sessionString.length < 50)) {
    console.warn(
      '⚠️ TELEGRAM_SESSION_STRING format is invalid (must start with "1"). Discarding and using Bot Token.'
    );
    sessionString = '';
  }

  if (!botToken && !sessionString) {
    throw new Error(
      'Either TELEGRAM_BOT_TOKEN or TELEGRAM_SESSION_STRING must be configured in your .env file.'
    );
  }

  console.log('🔄 Initializing GramJS Telegram client...');

  // Safely instantiate StringSession with error handling to avoid "Not a valid string" crashes
  let stringSession;
  if (sessionString) {
    try {
      stringSession = new StringSession(sessionString);
    } catch (sessionErr) {
      console.warn(
        `⚠️ Invalid TELEGRAM_SESSION_STRING ("${sessionErr.message}"). Discarding and falling back to Bot Token.`
      );
      sessionString = '';
      stringSession = new StringSession('');
    }
  } else {
    stringSession = new StringSession('');
  }

  clientInstance = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    if (sessionString) {
      // Connect using pre-existing StringSession
      console.log('🔑 Connecting via saved StringSession...');
      await clientInstance.connect();
      console.log('✅ Telegram client connected using saved StringSession.');
    } else {
      // Authenticate via Bot Token
      console.log('🤖 Authenticating via TELEGRAM_BOT_TOKEN...');
      await clientInstance.start({
        botAuthToken: botToken,
      });
      console.log('✅ Telegram client authenticated using Bot Token.');
      // Export and save session string for faster reconnects
      exportSessionString(clientInstance);
    }

    try {
      const me = await clientInstance.getMe();
      console.log(`🤖 Logged in as: @${me.username || me.firstName} (ID: ${me.id})`);
    } catch (meErr) {
      if (meErr.message && meErr.message.includes('AUTH_KEY_DUPLICATED')) {
        console.warn('⚠️ AUTH_KEY_DUPLICATED on saved session. Discarding and reconnecting with Bot Token...');
        return await resetTelegramClient();
      }
      throw meErr;
    }

    return clientInstance;
  } catch (error) {
    console.error('❌ Failed to initialize Telegram client:', error.message || error);
    // If the session string was invalid/revoked or duplicate key, retry once with bot token
    if (botToken) {
      console.log('🔄 Retrying login using TELEGRAM_BOT_TOKEN...');
      try {
        if (clientInstance) {
          await clientInstance.disconnect();
        }
      } catch (_) {}

      try {
        const fallbackSession = new StringSession('');
        clientInstance = new TelegramClient(fallbackSession, apiId, apiHash, {
          connectionRetries: 5,
        });
        await clientInstance.start({
          botAuthToken: botToken,
        });
        console.log('✅ Telegram client re-authenticated using Bot Token.');
        exportSessionString(clientInstance);
        return clientInstance;
      } catch (retryErr) {
        console.error('❌ Bot Token fallback authentication failed:', retryErr.message || retryErr);
        throw retryErr;
      }
    }
    throw error;
  }
}

/**
 * Force-disconnects the current client, clears any stale session,
 * and initializes a fresh Telegram client instance via Bot Token.
 * @returns {Promise<TelegramClient>}
 */
async function resetTelegramClient() {
  console.log('🔄 Resetting Telegram MTProto client session...');
  if (clientInstance) {
    try {
      await clientInstance.disconnect();
    } catch (e) {
      // Disconnect error can be safely ignored
    }
    clientInstance = null;
  }

  // Clear environment variable for this process so it uses Bot Token
  process.env.TELEGRAM_SESSION_STRING = '';

  return await initTelegramClient();
}

/**
 * Returns the currently active TelegramClient or initializes it if not ready.
 * @returns {Promise<TelegramClient>}
 */
async function getTelegramClient() {
  if (!clientInstance || !clientInstance.connected) {
    return await initTelegramClient();
  }
  return clientInstance;
}

/**
 * Resolves the channel entity from process.env.TELEGRAM_CHANNEL_ID
 * @param {TelegramClient} client
 * @returns {Promise<any>} InputEntity or Entity
 */
async function getChannelEntity(client) {
  const rawChannelId = (process.env.TELEGRAM_CHANNEL_ID || '').trim();
  if (!rawChannelId) {
    throw new Error('TELEGRAM_CHANNEL_ID is not configured in your .env file.');
  }

  try {
    // If it's a numeric channel ID (e.g. -1001234567890 or 1234567890)
    if (/^-?\d+$/.test(rawChannelId)) {
      try {
        return await client.getInputEntity(BigInt(rawChannelId));
      } catch {
        return await client.getInputEntity(rawChannelId);
      }
    }
    // If it's a public channel username or invite handle
    return await client.getInputEntity(rawChannelId);
  } catch (primaryErr) {
    try {
      return await client.getEntity(rawChannelId);
    } catch (fallbackErr) {
      console.error(
        `❌ Could not resolve channel entity '${rawChannelId}'. Please ensure the bot is added as an administrator to the channel.`
      );
      throw fallbackErr;
    }
  }
}

module.exports = {
  initTelegramClient,
  getTelegramClient,
  resetTelegramClient,
  exportSessionString,
  getChannelEntity,
};

