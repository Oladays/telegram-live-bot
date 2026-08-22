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

// ---- Edit this list any time to add/remove messages ----
const messages = [
  '✅ ₦50,000 GIVEAWAY LIVE NOW!!',
  'WHERE ARE YOU?? 🫵🏽🫵🏽',
  '🫵🏽 ₦50,000 GIVEAWAY FOR YOU',
  'MAKING MONEY LIVE NOW 🔥',
  'LETS MAKE MONEY LIVE NOW 🔥🔥',
  'LIVE TRADING STARTED!! 🥳',
];

const POSTS_PER_ROUND = 8;      // how many messages go out before reshuffling
const DELETE_AFTER_MS = 15_000; // delete each message 15s after posting
const POST_INTERVAL_MS = 4_000; // send a new message every 4s (independent of deletion)

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

async function postAndDelete() {
  const text = nextMessage();
  try {
    const sent = await bot.sendMessage(channelId, `<b>${text}</b>`, { parse_mode: 'HTML' });
    setTimeout(async () => {
      try {
        await bot.deleteMessage(channelId, sent.message_id);
      } catch (err) {
        console.error('Delete failed:', err.message);
      }
    }, DELETE_AFTER_MS);
  } catch (err) {
    console.error('Send failed:', err.message);
  }
}

async function runRound() {
  for (let i = 0; i < POSTS_PER_ROUND; i++) {
    if (!isLive) return;
    postAndDelete(); // fire and forget — deletion is handled independently inside
    await wait(POST_INTERVAL_MS);
  }
  if (isLive) runRound(); // start the next round automatically
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
