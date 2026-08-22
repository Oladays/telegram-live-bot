# Telegram Live Hype Bot

Posts a random message from your list to your channel, deletes it 30s later,
then posts the next — 8 per round, reshuffling each round, never repeating a
message back-to-back. You control it with `/live start` and `/live stop`
sent to the bot from your own Telegram account.

## 1. Create the bot (2 min, on your phone)

1. Open Telegram, search **@BotFather**, tap Start.
2. Send `/newbot`, give it a name and a username (must end in `bot`).
3. BotFather gives you a **token** — copy it.

## 2. Get your channel ID

- If your channel has a public username: use `@yourchannelusername` directly.
- If it's private: forward any message from the channel to **@userinfobot**
  (or **@RawDataBot**) — it'll show a `channel_id` like `-1001234567890`.

## 3. Get your own Telegram user ID

- Message **@userinfobot** — it replies with your numeric `id`. This is
  `ADMIN_ID`, so only you can start/stop the automation.

## 4. Add the bot to your channel

- Open your channel → Administrators → Add Admin → search your bot's
  username → give it permission to **post and delete messages**.

## 5. Set environment variables

Copy `.env.example` to `.env` and fill in the three values (or set them
directly in Render's dashboard under Environment).

## 6. Deploy to Render

1. Push this folder to a GitHub repo (or add it to an existing one).
2. On Render: New → Background Worker (not Web Service — this bot doesn't
   need to receive HTTP traffic, just run continuously).
3. Build command: `npm install`
4. Start command: `npm start`
5. Add the three environment variables from step 5.
6. Deploy.

## 7. Use it

From your own Telegram account, DM the bot (or use it in the channel if
you're an admin there):

- `/live start` — begins posting
- `/live stop` — stops posting

## Editing the messages

Open `bot.js` and edit the `messages` array near the top — add, remove, or
change any line. No need to touch the rest of the code.

## Notes

- Timing: 30s visible, then delete, then a 5s pause before the next post
  (~35s between posts). Change `DELETE_AFTER_MS` / `GAP_AFTER_DELETE_MS` in
  `bot.js` if you want it faster or slower.
- Round size: 8 posts per round is set by `POSTS_PER_ROUND`.
- No-repeat logic: messages are shuffled into a queue; a message can't post
  twice in a row, even across a reshuffle.
