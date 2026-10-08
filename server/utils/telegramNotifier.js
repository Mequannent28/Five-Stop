/**
 * Five Stop — Telegram Notification Service
 * ─────────────────────────────────────────────────────────────────
 * Sends richly-formatted HTML messages to a Telegram bot/channel
 * whenever a meaningful CRUD event occurs in the system.
 *
 * Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in your .env file.
 * If either is missing the module silently no-ops (safe for dev).
 */

const https   = require('https');
const Setting = require('../models/Setting');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Fallback: env-var chat IDs (used if DB has no subscribers yet)
const ENV_CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '')
  .split(',')
  .map(id => id.trim())
  .filter(id => id && id !== 'your_chat_id_here');
const HOTEL = 'Five Stop Hotel';

// ── Low-level sender ─────────────────────────────────────────────
async function getChatIds() {
  try {
    const settings = await Setting.findOne().select('telegramSubscribers').lean();
    const dbIds = (settings?.telegramSubscribers || []).map(s => String(s.chatId));
    // Merge DB subscribers with env fallback, deduplicated
    const all = [...new Set([...dbIds, ...ENV_CHAT_IDS])];
    return all.filter(Boolean);
  } catch {
    return ENV_CHAT_IDS;
  }
}

function sendToOne(chatId, text) {
  const body = JSON.stringify({
    chat_id:    chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });

  const options = {
    hostname: 'api.telegram.org',
    path:     `/bot${BOT_TOKEN}/sendMessage`,
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };

  const req = https.request(options, (res) => {
    if (res.statusCode !== 200) {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => console.warn(`[Telegram] Non-200 for chat ${chatId}:`, data));
    }
  });
  req.on('error', (err) => console.warn(`[Telegram] Send error to ${chatId}:`, err.message));
  req.write(body);
  req.end();
}

function sendTelegram(text) {
  if (!BOT_TOKEN || BOT_TOKEN === 'your_bot_token_here') return;
  // Fire-and-forget async
  getChatIds().then(ids => {
    if (!ids.length) return;
    ids.forEach(id => sendToOne(id, text));
  }).catch(() => {});
}

// ── Timestamp helper ─────────────────────────────────────────────
function now() {
  return new Date().toLocaleString('en-US', {
    timeZone:    'Africa/Addis_Ababa',
    weekday:     'short',
    year:        'numeric',
    month:       'short',
    day:         'numeric',
    hour:        '2-digit',
    minute:      '2-digit',
  });
}

// ── ETB formatter ────────────────────────────────────────────────
function etb(n) {
  return `ETB ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC NOTIFICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// ── AUTH ────────────────────────────────────────────────────────

/** User logged in */
function notifyLogin(user) {
  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🔐 <b>USER LOGIN</b>

👤 <b>Name:</b>  ${user.name}
📧 <b>Email:</b> ${user.email}
🎭 <b>Role:</b>  ${user.role.toUpperCase()}
🕐 <b>Time:</b>  ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

/** New staff account created */
function notifyUserCreated(newUser, createdBy) {
  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
👥 <b>NEW STAFF ACCOUNT</b>

👤 <b>Name:</b>       ${newUser.name}
📧 <b>Email:</b>      ${newUser.email}
🎭 <b>Role:</b>       ${newUser.role.toUpperCase()}
🛠 <b>Created by:</b> ${createdBy || 'System'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── STOCK TRANSACTIONS ───────────────────────────────────────────

const VOUCHER_EMOJI = {
  cash_grv:       '💵',
  credit_grv:     '🏦',
  fresh_bazaar:   '🌿',
  pos_adjustment: '📈',
  neg_adjustment: '📉',
  disposal:       '🗑️',
  sales_import:   '📥',
};

const VOUCHER_LABEL = {
  cash_grv:       'Cash GRV',
  credit_grv:     'Credit GRV',
  fresh_bazaar:   'Fresh Bazaar',
  pos_adjustment: 'Positive Adjustment',
  neg_adjustment: 'Negative Adjustment',
  disposal:       'Disposal',
  sales_import:   'Sales Import',
};

/** New stock transaction created */
function notifyTransaction(txn, user) {
  const emoji = VOUCHER_EMOJI[txn.voucherType] || '📦';
  const label = VOUCHER_LABEL[txn.voucherType] || txn.voucherType;
  const direction = txn.type === 'in' ? '📥 IN' : '📤 OUT';

  const items = (txn.items || []).map(i =>
    `  • ${i.material?.name || '—'} × <b>${i.quantity}</b> ${i.material?.unit || ''} @ ${etb(i.unitCost)}`
  ).join('\n');

  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
${emoji} <b>NEW ${label.toUpperCase()}</b>

🔖 <b>Voucher No:</b>  ${txn.voucherNo || 'Auto'}
↕️  <b>Direction:</b>  ${direction}
🏪 <b>Supplier:</b>   ${txn.supplier?.name || '—'}
💰 <b>Total:</b>      ${etb(txn.totalAmount)}
📋 <b>Status:</b>     ${(txn.status || 'pending').toUpperCase()}

📦 <b>Items:</b>
${items || '  —'}

👤 <b>Recorded by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>        ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

/** Transaction workflow advanced (check / approve / post / void) */
function notifyTransactionAdvanced(txn, action, by) {
  const actionEmoji = {
    check:   '✅',
    approve: '🟣',
    post:    '🟢',
    void:    '🔴',
  };
  const emoji = actionEmoji[action] || '🔄';
  const label = VOUCHER_LABEL[txn.voucherType] || txn.voucherType;

  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
${emoji} <b>VOUCHER ${action.toUpperCase()}ED</b>

🔖 <b>Voucher:</b> ${txn.voucherNo || txn._id?.toString().slice(-6)}
📄 <b>Type:</b>    ${label}
💰 <b>Total:</b>   ${etb(txn.totalAmount)}
📋 <b>Status:</b>  ${(txn.status || '').toUpperCase()}

👤 <b>By:</b>   ${by?.name || '—'} (${by?.role || ''})
🕐 <b>Time:</b> ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

/** Transaction deleted / moved to recycle bin */
function notifyTransactionDeleted(txn, user) {
  const label = VOUCHER_LABEL[txn.voucherType] || txn.voucherType;
  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>TRANSACTION DELETED</b>

🔖 <b>Voucher:</b> ${txn.voucherNo || '—'}
📄 <b>Type:</b>    ${label}
💰 <b>Total:</b>   ${etb(txn.totalAmount)}

👤 <b>Deleted by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── RAW MATERIALS ────────────────────────────────────────────────

/** Raw material created */
function notifyMaterialCreated(mat, user) {
  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🧱 <b>NEW RAW MATERIAL</b>

🏷 <b>Code:</b>          ${mat.code || '—'}
📦 <b>Name:</b>          ${mat.name}
🗂 <b>Category:</b>      ${mat.category || '—'}
⚖️  <b>Unit:</b>          ${mat.unit}
📊 <b>Opening Stock:</b> ${mat.currentStock} ${mat.unit}
💰 <b>Unit Cost:</b>     ${etb(mat.unitCost)}

👤 <b>Added by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>     ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

/** Raw material updated */
function notifyMaterialUpdated(mat, user) {
  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
✏️ <b>RAW MATERIAL UPDATED</b>

🏷 <b>Code:</b>          ${mat.code || '—'}
📦 <b>Name:</b>          ${mat.name}
📊 <b>Current Stock:</b> ${mat.currentStock} ${mat.unit}
💰 <b>Unit Cost:</b>     ${etb(mat.unitCost)}

👤 <b>Updated by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

/** Raw material deleted */
function notifyMaterialDeleted(mat, user) {
  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>RAW MATERIAL DELETED</b>

📦 <b>Name:</b>     ${mat.name}
🏷 <b>Code:</b>     ${mat.code || '—'}
📊 <b>Stock was:</b> ${mat.currentStock} ${mat.unit}

👤 <b>Deleted by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── SUPPLIERS ────────────────────────────────────────────────────

function notifySupplierCreated(supplier, user) {
  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🚚 <b>NEW SUPPLIER</b>

🏢 <b>Name:</b>     ${supplier.name}
🗂 <b>Category:</b> ${supplier.category || 'General'}
👤 <b>Contact:</b>  ${supplier.contactPerson || '—'}
📞 <b>Phone:</b>    ${supplier.phone || '—'}

🛠 <b>Added by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>     ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifySupplierDeleted(supplier, user) {
  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>SUPPLIER DELETED</b>

🏢 <b>Name:</b>     ${supplier.name}
🗂 <b>Category:</b> ${supplier.category || '—'}

👤 <b>Deleted by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── PRODUCTS ─────────────────────────────────────────────────────

function notifyProductCreated(product, user) {
  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🍽️ <b>NEW PRODUCT</b>

🏷 <b>Code:</b>        ${product.code || '—'}
📦 <b>Name:</b>        ${product.name}
🗂 <b>Category:</b>    ${product.category || '—'}
🧪 <b>Ingredients:</b> ${product.ingredients?.length || 0} item(s)
💰 <b>Sell Price:</b>  ${etb(product.sellingPrice)}

👤 <b>Added by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>     ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyProductDeleted(product, user) {
  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>PRODUCT DELETED</b>

📦 <b>Name:</b>     ${product.name}
🏷 <b>Code:</b>     ${product.code || '—'}

👤 <b>Deleted by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── SYSTEM SETTINGS ──────────────────────────────────────────────

function notifySettingsChanged(changes, user) {
  const lines = Object.entries(changes)
    .filter(([k]) => !['rolePermissions','navVisibility'].includes(k))
    .map(([k, v]) => `  • <b>${k}:</b> ${v}`)
    .join('\n');

  const permChanged = 'rolePermissions' in changes || 'navVisibility' in changes;

  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
⚙️ <b>SYSTEM SETTINGS CHANGED</b>

${lines || '  (permissions / nav visibility only)'}
${permChanged ? '\n🔐 Role permissions or nav visibility were updated.' : ''}
👤 <b>Changed by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── RECYCLE BIN ──────────────────────────────────────────────────

function notifyRestored(type, name, user) {
  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
♻️ <b>ITEM RESTORED</b>

📂 <b>Type:</b> ${type}
📦 <b>Item:</b> ${name}

👤 <b>Restored by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>        ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyBinEmptied(user) {
  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>RECYCLE BIN EMPTIED</b>

All deleted items permanently removed.

👤 <b>By:</b>   ${user?.name || '—'}
🕐 <b>Time:</b> ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── INVENTORY COUNT ──────────────────────────────────────────────

function notifyInventoryCountSubmitted(count, user) {
  sendTelegram(
`🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
📋 <b>INVENTORY COUNT SUBMITTED</b>

🏪 <b>Store:</b>  ${count.storeName || 'Main Store'}
📅 <b>Period:</b> ${count.period || '—'}
📊 <b>Items:</b>  ${count.items?.length || 0} lines counted

👤 <b>Submitted by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>         ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ─────────────────────────────────────────────────────────────────
module.exports = {
  notifyLogin,
  notifyUserCreated,
  notifyTransaction,
  notifyTransactionAdvanced,
  notifyTransactionDeleted,
  notifyMaterialCreated,
  notifyMaterialUpdated,
  notifyMaterialDeleted,
  notifySupplierCreated,
  notifySupplierDeleted,
  notifyProductCreated,
  notifyProductDeleted,
  notifySettingsChanged,
  notifyRestored,
  notifyBinEmptied,
  notifyInventoryCountSubmitted,
};
