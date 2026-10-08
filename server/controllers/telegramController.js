const asyncHandler = require('express-async-handler');
const Setting = require('../models/Setting');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ── Send a reply directly to one chat ────────────────────────────
async function reply(chatId, text) {
  try {
    const https = require('https');
    const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options);
    req.on('error', () => {});
    req.write(body);
    req.end();
  } catch {}
}

// ── POST /api/telegram/webhook ───────────────────────────────────
// Telegram calls this endpoint for every message sent to the bot.
const handleWebhook = asyncHandler(async (req, res) => {
  // Always respond 200 immediately — Telegram will retry if we're slow
  res.sendStatus(200);

  const update = req.body;
  const message = update?.message || update?.edited_message;
  if (!message) return;

  const chatId   = message.chat?.id;
  const from     = message.from;
  const text     = (message.text || '').trim().toLowerCase();
  const name     = [from?.first_name, from?.last_name].filter(Boolean).join(' ') || 'Unknown';
  const username = from?.username || '';

  if (!chatId) return;

  let settings = await Setting.findOne();
  if (!settings) settings = new Setting();

  const subscribers = settings.telegramSubscribers || [];
  const alreadySubscribed = subscribers.some(s => String(s.chatId) === String(chatId));

  // ── /start or /subscribe ──────────────────────────────────────
  if (text === '/start' || text.startsWith('/subscribe')) {
    if (alreadySubscribed) {
      await reply(chatId,
`✅ <b>Already subscribed!</b>

You are already receiving Five Stop Hotel notifications.

To unsubscribe, send /unsubscribe`
      );
      return;
    }

    subscribers.push({
      chatId: String(chatId),
      name,
      username,
      subscribedAt: new Date(),
    });
    settings.telegramSubscribers = subscribers;
    settings.markModified('telegramSubscribers');
    await settings.save();

    await reply(chatId,
`🏨 <b>Five Stop Hotel</b>
━━━━━━━━━━━━━━━━━━━━
✅ <b>Subscribed successfully!</b>

Welcome, <b>${name}</b>!

You will now receive real-time alerts for:
🔐 User logins
📦 Stock transactions (GRV, Disposal, etc.)
✅ Voucher approvals & workflow steps
🧱 Raw material changes
🚚 Supplier changes
🍽️ Product changes
⚙️ System settings changes
🗑️ Recycle bin actions

To stop notifications, send /unsubscribe
━━━━━━━━━━━━━━━━━━━━`
    );
    return;
  }

  // ── /unsubscribe ──────────────────────────────────────────────
  if (text.startsWith('/unsubscribe')) {
    if (!alreadySubscribed) {
      await reply(chatId, '❌ You are not currently subscribed to Five Stop notifications.');
      return;
    }

    settings.telegramSubscribers = subscribers.filter(s => String(s.chatId) !== String(chatId));
    settings.markModified('telegramSubscribers');
    await settings.save();

    await reply(chatId,
`🏨 <b>Five Stop Hotel</b>
━━━━━━━━━━━━━━━━━━━━
🔕 <b>Unsubscribed</b>

You will no longer receive notifications.
Send /subscribe anytime to re-subscribe.
━━━━━━━━━━━━━━━━━━━━`
    );
    return;
  }

  // ── /status ───────────────────────────────────────────────────
  if (text === '/status') {
    await reply(chatId,
      alreadySubscribed
        ? `✅ You are <b>subscribed</b> to Five Stop Hotel notifications.\n\nSend /unsubscribe to stop.`
        : `❌ You are <b>not subscribed</b>.\n\nSend /subscribe to start receiving notifications.`
    );
    return;
  }

  // ── Unknown command ───────────────────────────────────────────
  await reply(chatId,
`🏨 <b>Five Stop Hotel Bot</b>

Available commands:
/subscribe   — Start receiving notifications
/unsubscribe — Stop receiving notifications
/status      — Check your subscription status`
  );
});

// ── GET /api/telegram/subscribers (admin only) ───────────────────
const getSubscribers = asyncHandler(async (req, res) => {
  const settings = await Setting.findOne();
  res.json(settings?.telegramSubscribers || []);
});

// ── DELETE /api/telegram/subscribers/:chatId (admin only) ────────
const removeSubscriber = asyncHandler(async (req, res) => {
  const settings = await Setting.findOne();
  if (!settings) return res.json({ message: 'No settings found' });

  settings.telegramSubscribers = (settings.telegramSubscribers || [])
    .filter(s => String(s.chatId) !== String(req.params.chatId));
  settings.markModified('telegramSubscribers');
  await settings.save();

  res.json({ message: 'Subscriber removed.' });
});

module.exports = { handleWebhook, getSubscribers, removeSubscriber };
