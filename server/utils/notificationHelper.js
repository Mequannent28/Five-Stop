/**
 * In-app Notification Helper
 * Creates persistent notifications in MongoDB that the Topbar bell reads.
 * All calls are fire-and-forget (non-blocking).
 */
const Notification = require('../models/Notification');

function push({ type = 'system', title, message, icon = '📦', link = '', severity = 'info', userId }) {
  Notification.create({ type, title, message, icon, link, severity, createdBy: userId || null })
    .catch(err => console.warn('[Notification] push failed:', err.message));
}

module.exports = { push };
