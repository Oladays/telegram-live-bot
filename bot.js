require('dotenv').config();
console.log('Starting bot...');

const http = require('http');
const TelegramBot = require('node-telegram-bot-api');

let startupError = null;

const token = process.env.BOT_TOKEN;
const channelId = process.env.CHANNEL_ID;
const adminId = process.env.ADMIN_ID;

if (!token || !channelId || !adminId) {
  startupError = `Missing env vars — BOT_TOKEN:${!!token} CHANNEL_ID:${!!channelId} ADMIN_ID:${!!adminId}`;
  console.log(startupError);
}

// Render (free tier) requires a Web Service to bind to a port.
// This also doubles as a way to see startup errors from your phone browser.
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.end(startupError ? `STARTUP ERROR: ${startupError}` : 'Bot is running.');
}).listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});

if (startupError) {
  // Don't exit — stay alive so the error is visible instead of getting lost
  // in a fast crash/restart loop.
} else {
  runBot();
}

function runBot() {
  try {
    const bot = new TelegramBot(token, { polling: true });

    bot.on('polling_error', (err) => {
      console.log('Polling error:', err.message);
      startupError = `Polling error: ${err.message}`;
    });
    process.on('unhandledRejection', (err) => {
      console.log('Unhandled rejection:', err && err.message ? err.message : err);
    });
    process.on('uncaughtException', (err) => {
      console.log('Uncaught exception:', err && err.message ? err.message : err);
    });

const fs = require('fs');
const path = require('path');
const LIVE_MESSAGES_FILE = path.join(__dirname, 'messages.json');
const AUTO_MESSAGES_FILE = path.join(__dirname, 'auto-messages.json');

const defaultLiveMessages = [
  '✅ $50~75,000 GIVEAWAY LIVE NOW!!',
  'WHERE ARE YOU?? 🫵🏽🫵🏽',
  '🫵🏽 $50~75,000 GIVEAWAY FOR YOU',
  'MAKING MONEY LIVE NOW 🔥',
  'LETS MAKE MONEY LIVE NOW 🔥🔥',
  'LIVE TRADING STARTED!! 🥳',
  "Send your TRADING RESULTS/MESSAGES/SCREENSHOTS to\nhttps://t.me/higainotcadmin\n\nLet's Keep Winning 💪✅",
];

const defaultAutoMessages = [];

function loadMessages(file, defaults) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (err) {
    // file doesn't exist yet or is invalid — fall back to defaults
  }
  return [...defaults];
}

function saveMessages(file, msgs) {
  fs.writeFileSync(file, JSON.stringify(msgs, null, 2));
}

let liveMessages = loadMessages(LIVE_MESSAGES_FILE, defaultLiveMessages);
let autoMessages = loadMessages(AUTO_MESSAGES_FILE, defaultAutoMessages);

// Track the last auto-posted message on disk, so even a restart can't
// accidentally repeat the same message twice in a row.
const AUTO_STATE_FILE = path.join(__dirname, 'auto-state.json');
function keyOf(m) {
  return typeof m === 'string' ? m : JSON.stringify(m);
}
function loadLastAutoKey() {
  try {
    const raw = fs.readFileSync(AUTO_STATE_FILE, 'utf8');
    return JSON.parse(raw).lastKey || null;
  } catch (err) {
    return null;
  }
}
function saveLastAutoKey(key) {
  fs.writeFileSync(AUTO_STATE_FILE, JSON.stringify({ lastKey: key }));
}
let lastAutoKey = loadLastAutoKey();

const POSTS_PER_ROUND = 4;      // how many copies of a message go out per batch
const DELETE_AFTER_MS = 8_000;  // how long the batch sits after the last one is sent
const SEND_GAP_MS = 2_000;      // gap between each send

let isLive = false;
let queue = [];
let autoQueue = [];

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Refill a queue with a fresh shuffled batch from the given source pool,
// making sure the first message of the new batch never matches the last
// message of the old batch (so nothing can post twice in a row).
function refillQueue(q, sourcePool) {
  const last = q.length ? q[q.length - 1] : null;
  let batch = shuffle(sourcePool);
  if (last && batch[0] === last) {
    [batch[0], batch[1]] = [batch[1], batch[0]];
  }
  q.push(...batch);
}

function nextMessage() {
  if (queue.length === 0) refillQueue(queue, liveMessages);
  return queue.shift();
}

function nextAutoMessage() {
  if (autoQueue.length === 0) {
    refillQueue(autoQueue, autoMessages);
    // Extra safety: also compare against the persisted last-sent key,
    // since the in-memory queue's own "last item" check doesn't survive
    // a restart. If there's more than one message and the first item in
    // the fresh batch matches what was last sent (even before a restart),
    // swap it out.
    if (autoQueue.length > 1 && keyOf(autoQueue[0]) === lastAutoKey) {
      [autoQueue[0], autoQueue[1]] = [autoQueue[1], autoQueue[0]];
    }
  }
  const next = autoQueue.shift();
  lastAutoKey = keyOf(next);
  saveLastAutoKey(lastAutoKey);
  return next;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postBatch(message) {
  const isPhoto = typeof message === 'object' && message.photo;

  // Send all copies with a small gap between each
  const sentMessages = [];
  for (let i = 0; i < POSTS_PER_ROUND; i++) {
    try {
      let sent;
      if (isPhoto) {
        sent = await bot.sendPhoto(channelId, message.photo, {
          caption: message.caption ? `<b>${message.caption}</b>` : undefined,
          parse_mode: message.caption ? 'HTML' : undefined,
        });
      } else {
        sent = await bot.sendMessage(channelId, `<b>${message}</b>`, { parse_mode: 'HTML' });
      }
      sentMessages.push(sent);
    } catch (err) {
      console.log('Send failed:', err.message);
    }
    if (i < POSTS_PER_ROUND - 1) await wait(SEND_GAP_MS);
  }

  // Let all 8 sit visible for 15s, then delete all of them together
  await wait(DELETE_AFTER_MS);
  await Promise.all(
    sentMessages.map((sent) =>
      bot.deleteMessage(channelId, sent.message_id).catch((err) => {
        console.log('Delete failed:', err.message);
      })
    )
  );
}

async function runRound() {
  if (!isLive) return;
  const text = nextMessage();
  await postBatch(text);
  if (isLive) runRound(); // move to the next message and repeat
}

function startLive(chatId) {
  if (isLive) {
    if (chatId) bot.sendMessage(chatId, 'Already live.');
    return;
  }
  isLive = true;
  queue = [];
  if (chatId) bot.sendMessage(chatId, '🔴 Live automation started.');
  runRound();
}

function stopLive(chatId) {
  isLive = false;
  if (chatId) bot.sendMessage(chatId, '⏹ Live automation stopped.');
}

// Manage messages directly from Telegram — no code editing needed.
// LIVE messages = shown during /live start, deleted after each batch.
// AUTO messages = posted every 30 min permanently, independent of live.

bot.onText(/\/addmsg ([\s\S]+)/, (msg, match) => {
  if (String(msg.from.id) !== String(adminId)) return;
  liveMessages.push(match[1].trim());
  saveMessages(LIVE_MESSAGES_FILE, liveMessages);
  bot.sendMessage(msg.chat.id, `✅ Added to LIVE messages. You now have ${liveMessages.length}. Send /listmsg to see them.`);
});

bot.onText(/\/addauto ([\s\S]+)/, (msg, match) => {
  if (String(msg.from.id) !== String(adminId)) return;
  autoMessages.push(match[1].trim());
  saveMessages(AUTO_MESSAGES_FILE, autoMessages);
  bot.sendMessage(msg.chat.id, `✅ Added to AUTO-POST messages. You now have ${autoMessages.length}. Send /listauto to see them.`);
});

// Send a photo with a caption directly to the bot (as admin) to add it.
// Caption must start with "live:" or "auto:" to say which pool it goes to
// — e.g. caption "auto: 🚀 1 Week Trading Competition is LIVE!..."
bot.on('photo', (msg) => {
  if (String(msg.from.id) !== String(adminId)) return;
  const largest = msg.photo[msg.photo.length - 1]; // highest resolution version
  const rawCaption = msg.caption || '';

  let target = 'live';
  let caption = rawCaption;
  if (/^auto:/i.test(rawCaption)) {
    target = 'auto';
    caption = rawCaption.replace(/^auto:\s*/i, '');
  } else if (/^live:/i.test(rawCaption)) {
    target = 'live';
    caption = rawCaption.replace(/^live:\s*/i, '');
  }

  const entry = { photo: largest.file_id, caption };
  if (target === 'auto') {
    autoMessages.push(entry);
    saveMessages(AUTO_MESSAGES_FILE, autoMessages);
    bot.sendMessage(msg.chat.id, `🖼 Photo added to AUTO-POST. You now have ${autoMessages.length}. Send /listauto to see them.`);
  } else {
    liveMessages.push(entry);
    saveMessages(LIVE_MESSAGES_FILE, liveMessages);
    bot.sendMessage(msg.chat.id, `🖼 Photo added to LIVE messages. You now have ${liveMessages.length}. Send /listmsg to see them.\n\nTip: start your caption with "auto:" next time to send it to the 24/7 auto-post pool instead.`);
  }
});

function formatList(pool) {
  return pool
    .map((m, i) => {
      if (typeof m === 'object' && m.photo) {
        return `${i + 1}. [PHOTO] ${m.caption || '(no caption)'}`;
      }
      return `${i + 1}. ${m}`;
    })
    .join('\n\n');
}

bot.onText(/\/listmsg/, (msg) => {
  if (String(msg.from.id) !== String(adminId)) return;
  bot.sendMessage(msg.chat.id, formatList(liveMessages) || 'No LIVE messages yet.');
});

bot.onText(/\/listauto/, (msg) => {
  if (String(msg.from.id) !== String(adminId)) return;
  bot.sendMessage(msg.chat.id, formatList(autoMessages) || 'No AUTO-POST messages yet.');
});

bot.onText(/\/delmsg (\d+)/, (msg, match) => {
  if (String(msg.from.id) !== String(adminId)) return;
  const index = parseInt(match[1], 10) - 1;
  if (index < 0 || index >= liveMessages.length) {
    bot.sendMessage(msg.chat.id, 'Invalid number. Send /listmsg to see valid numbers.');
    return;
  }
  const removed = liveMessages.splice(index, 1);
  saveMessages(LIVE_MESSAGES_FILE, liveMessages);
  const label = typeof removed[0] === 'object' ? '[PHOTO]' : removed[0];
  bot.sendMessage(msg.chat.id, `🗑 Removed from LIVE: "${label}"\nYou now have ${liveMessages.length}.`);
});

bot.onText(/\/delauto (\d+)/, (msg, match) => {
  if (String(msg.from.id) !== String(adminId)) return;
  const index = parseInt(match[1], 10) - 1;
  if (index < 0 || index >= autoMessages.length) {
    bot.sendMessage(msg.chat.id, 'Invalid number. Send /listauto to see valid numbers.');
    return;
  }
  const removed = autoMessages.splice(index, 1);
  saveMessages(AUTO_MESSAGES_FILE, autoMessages);
  const label = typeof removed[0] === 'object' ? '[PHOTO]' : removed[0];
  bot.sendMessage(msg.chat.id, `🗑 Removed from AUTO-POST: "${label}"\nYou now have ${autoMessages.length}.`);
});

// Manual override — DM the bot from your admin account
bot.onText(/\/live (start|stop)/, (msg, match) => {
  if (String(msg.from.id) !== String(adminId)) return; // ignore anyone but you
  if (match[1] === 'start') startLive(msg.chat.id);
  else stopLive(msg.chat.id);
});

// Automatic detection — Telegram sends these as service messages in the
// channel when a video chat (Live) actually starts/ends. Requires the bot
// to be an admin in the channel so it receives channel posts.
bot.on('channel_post', (post) => {
  const idMatches = String(post.chat.id) === String(channelId);
  const usernameMatches = post.chat.username && `@${post.chat.username}` === String(channelId);
  if (!idMatches && !usernameMatches) return;
  if (post.video_chat_started) startLive(null);
  if (post.video_chat_ended) stopLive(null);
});

const AUTOPOST_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

async function autoPostOnce() {
  const message = nextAutoMessage();
  const isPhoto = typeof message === 'object' && message.photo;
  try {
    if (isPhoto) {
      await bot.sendPhoto(channelId, message.photo, {
        caption: message.caption ? `<b>${message.caption}</b>` : undefined,
        parse_mode: message.caption ? 'HTML' : undefined,
      });
    } else {
      await bot.sendMessage(channelId, `<b>${message}</b>`, { parse_mode: 'HTML' });
    }
  } catch (err) {
    console.log('Autopost send failed:', err.message);
  }
}

// Runs 24/7, independent of /live start|stop — a permanent post every 30 min.
setInterval(autoPostOnce, AUTOPOST_INTERVAL_MS);
autoPostOnce(); // also post once right away on startup

console.log('Bot running. Auto-detects live start/end, or use /live start | /live stop manually.');
  } catch (err) {
    startupError = `Startup crash: ${err.message}`;
    console.log(startupError);
  }
}
