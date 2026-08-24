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
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

const defaultMessages = [
  '✅ ₦50,000 GIVEAWAY LIVE NOW!!',
  'WHERE ARE YOU?? 🫵🏽🫵🏽',
  '🫵🏽 ₦50,000 GIVEAWAY FOR YOU',
  'MAKING MONEY LIVE NOW 🔥',
  'LETS MAKE MONEY LIVE NOW 🔥🔥',
  'LIVE TRADING STARTED!! 🥳',
  "Send your TRADING RESULTS/MESSAGES/SCREENSHOTS to\nhttps://t.me/higainotcadmin\n\nLet's Keep Winning 💪✅",
];

function loadMessages() {
  try {
    const raw = fs.readFileSync(MESSAGES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (err) {
    // file doesn't exist yet or is invalid — fall back to defaults
  }
  return [...defaultMessages];
}

function saveMessages(msgs) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(msgs, null, 2));
}

let messages = loadMessages();

const POSTS_PER_ROUND = 4;      // how many copies of a message go out per batch
const DELETE_AFTER_MS = 8_000;  // how long the batch sits after the last one is sent
const SEND_GAP_MS = 2_000;      // gap between each send

let isLive = false;
let queue = [];

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Refill the queue with a fresh shuffled batch, making sure the first
// message of the new batch never matches the last message of the old batch
// (so nothing can post twice in a row, even across a reshuffle boundary).
function refillQueue() {
  const last = queue.length ? queue[queue.length - 1] : null;
  let batch = shuffle(messages);
  if (last && batch[0] === last) {
    [batch[0], batch[1]] = [batch[1], batch[0]];
  }
  queue.push(...batch);
}

function nextMessage() {
  if (queue.length === 0) refillQueue();
  return queue.shift();
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
bot.onText(/\/addmsg ([\s\S]+)/, (msg, match) => {
  if (String(msg.from.id) !== String(adminId)) return;
  messages.push(match[1].trim());
  saveMessages(messages);
  bot.sendMessage(msg.chat.id, `✅ Added. You now have ${messages.length} messages. Send /listmsg to see them.`);
});

// Send a photo with a caption directly to the bot (as admin) to add it as a
// photo message in the rotation. No caption needed if you just want the image.
bot.on('photo', (msg) => {
  if (String(msg.from.id) !== String(adminId)) return;
  const largest = msg.photo[msg.photo.length - 1]; // highest resolution version
  messages.push({ photo: largest.file_id, caption: msg.caption || '' });
  saveMessages(messages);
  bot.sendMessage(msg.chat.id, `🖼 Photo added. You now have ${messages.length} messages. Send /listmsg to see them.`);
});

bot.onText(/\/listmsg/, (msg) => {
  if (String(msg.from.id) !== String(adminId)) return;
  const list = messages
    .map((m, i) => {
      if (typeof m === 'object' && m.photo) {
        return `${i + 1}. [PHOTO] ${m.caption || '(no caption)'}`;
      }
      return `${i + 1}. ${m}`;
    })
    .join('\n\n');
  bot.sendMessage(msg.chat.id, list || 'No messages yet.');
});

bot.onText(/\/delmsg (\d+)/, (msg, match) => {
  if (String(msg.from.id) !== String(adminId)) return;
  const index = parseInt(match[1], 10) - 1;
  if (index < 0 || index >= messages.length) {
    bot.sendMessage(msg.chat.id, 'Invalid number. Send /listmsg to see valid numbers.');
    return;
  }
  const removed = messages.splice(index, 1);
  saveMessages(messages);
  bot.sendMessage(msg.chat.id, `🗑 Removed: "${removed[0]}"\nYou now have ${messages.length} messages.`);
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

console.log('Bot running. Auto-detects live start/end, or use /live start | /live stop manually.');
  } catch (err) {
    startupError = `Startup crash: ${err.message}`;
    console.log(startupError);
  }
}
