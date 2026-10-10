const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const tg = require('../utils/telegramNotifier');

// @desc  Register a new user (admin only, in practice)
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('A user with this email already exists');
  }

  const user = await User.create({ name, email, password, role });

  tg.notifyUserCreated(user, req.user);

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    avatar: user.avatar || '',
    token: generateToken(user._id),
  });
});

// @desc  Login user
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // ── Verify OTP token before allowing login ───────────────────
  const otpToken = req.headers['x-otp-token'] || req.body.otpToken;
  if (!otpToken) {
    res.status(401);
    throw new Error('OTP verification required. Please complete phone verification first.');
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(otpToken, process.env.JWT_SECRET);
    if (decoded.purpose !== 'otp_verified') throw new Error('Invalid OTP token');
  } catch (err) {
    res.status(401);
    throw new Error('OTP token is invalid or expired. Please verify your phone again.');
  }
  // ──────────────────────────────────────────────────────────────

  const user = await User.findOne({ email });

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error('This account has been deactivated. Contact your administrator.');
  }

  tg.notifyLogin(user);

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    avatar: user.avatar || '',
    token: generateToken(user._id),
  });
});

// @desc  Get current user profile
const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});

// @desc  Verify the current user's password (used for approval gates)
// POST /api/auth/verify-password  { password: "..." }
// Returns { valid: true } or 401
const verifyPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) { res.status(400); throw new Error('Password is required'); }

  // Re-fetch with password field (normally excluded)
  const user = await User.findById(req.user._id).select('+password');
  if (!user) { res.status(404); throw new Error('User not found'); }

  const match = await user.matchPassword(password);
  if (!match) { res.status(401); throw new Error('Incorrect password'); }

  res.json({ valid: true, userId: user._id, name: user.name, role: user.role });
});

// @desc  Update profile of current user (name, email, phone, avatar)
// PUT /api/auth/profile
const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (req.body.email && req.body.email.toLowerCase() !== user.email) {
    const emailExists = await User.findOne({ email: req.body.email.toLowerCase(), _id: { $ne: user._id } });
    if (emailExists) {
      res.status(400);
      throw new Error('This email is already in use by another account');
    }
    user.email = req.body.email.toLowerCase();
  }

  if (req.body.name) user.name = req.body.name;
  if (req.body.phone !== undefined) user.phone = req.body.phone;
  if (req.body.avatar !== undefined) user.avatar = req.body.avatar;

  const updated = await user.save();
  res.json({
    _id: updated._id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    phone: updated.phone || '',
    avatar: updated.avatar || '',
    token: generateToken(updated._id),
  });
});

// @desc  Change password of current user
// PUT /api/auth/password
const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('Both current and new password are required');
  }

  if (newPassword.length < 6) {
    res.status(400);
    throw new Error('New password must be at least 6 characters');
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const match = await user.matchPassword(currentPassword);
  if (!match) {
    res.status(400);
    throw new Error('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  res.json({ message: 'Password updated successfully' });
});

// ── OTP helpers ───────────────────────────────────────────────────────
const https = require('https');

function sendTelegramDirect(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'your_bot_token_here') return;
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };
  const req = https.request(options);
  req.on('error', () => {});
  req.write(body);
  req.end();
}

// @desc  Request OTP — sends 6-digit code to the phone-linked Telegram chat
// @route POST /api/auth/request-otp
// @access Public
const requestOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  if (!phone) { res.status(400); throw new Error('Phone number is required'); }

  const normalized = phone.replace(/\s+/g, '').replace(/^00251/, '+251');

  // ── Look up the phone in the registered subscriber list ────────────
  // Admin must have linked this phone via Settings → Telegram Subscribers.
  const Setting = require('../models/Setting');
  const settings = await Setting.findOne().select('telegramSubscribers').lean();
  const subscribers = settings?.telegramSubscribers || [];

  // Match by phone field (normalize both sides: treat 09x == +2519x)
  const normalize = (p = '') =>
    String(p).replace(/\s+/g, '')
             .replace(/^00251/, '+251')
             .replace(/^\+251/, '0');   // collapse to 09x for comparison

  const matchedSub = subscribers.find(s =>
    s.phone && normalize(s.phone) === normalize(normalized)
  );

  if (!matchedSub) {
    res.status(403);
    throw new Error('This phone number is not registered or not authorized. Contact your administrator.');
  }

  // ── Find the system user whose phone matches ────────────────────
  const user = await User.findOne({ isActive: true, $or: [
    { phone: normalized },
    { phone: normalize(normalized) },
    { phone: { $regex: normalize(normalized).replace(/^\+/, '\\+'), $options: 'i' } },
  ] });

  if (!user) {
    res.status(403);
    throw new Error('This phone number is not linked to any active system account. Contact your administrator.');
  }

  // ── Generate OTP ────────────────────────────────────────────────
  const otp    = String(Math.floor(100000 + Math.random() * 900000));
  const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  const salt = await bcrypt.genSalt(10);
  user.otpHash   = await bcrypt.hash(otp, salt);
  user.otpExpiry = expiry;
  await user.save();

  // ── Send OTP to the subscriber's exact Telegram chat ───────────
  sendTelegramDirect(matchedSub.chatId,
`🏨 <b>Five Stop Hotel</b>
━━━━━━━━━━━━━━━━━━━━
🔐 <b>Login OTP Code</b>

Your one-time password is:

<b>🔢 ${otp}</b>

⏱ Valid for <b>5 minutes</b>.
Do not share this code with anyone.
━━━━━━━━━━━━━━━━━━━━`
  );

  res.json({
    message: 'OTP sent to your Telegram.',
    maskedName: user.name.split(' ')[0] + ' ' + (user.name.split(' ')[1]?.[0] || '') + '.',
    userId: user._id,
  });
});

// @desc  Verify OTP
// @route POST /api/auth/verify-otp
// @access Public
const verifyOtp = asyncHandler(async (req, res) => {
  const { userId, otp } = req.body;
  if (!userId || !otp) { res.status(400); throw new Error('userId and otp are required'); }

  const user = await User.findById(userId).select('+otpHash +otpExpiry');
  if (!user) { res.status(404); throw new Error('User not found'); }

  if (!user.otpHash || !user.otpExpiry) {
    res.status(400); throw new Error('No OTP was requested. Please request a new one.');
  }

  if (new Date() > user.otpExpiry) {
    user.otpHash = null; user.otpExpiry = null;
    await user.save();
    res.status(400); throw new Error('OTP has expired. Please request a new one.');
  }

  const isMatch = await bcrypt.compare(String(otp).trim(), user.otpHash);
  if (!isMatch) { res.status(401); throw new Error('Incorrect OTP. Please try again.'); }

  // Clear OTP after successful verification
  user.otpHash = null; user.otpExpiry = null;
  await user.save();

  // Issue a short-lived otpToken (JWT, 10 min) to gate the login step
  const jwt = require('jsonwebtoken');
  const otpToken = jwt.sign(
    { id: user._id, purpose: 'otp_verified' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );

  res.json({ message: 'OTP verified.', otpToken });
});

module.exports = { registerUser, loginUser, getMe, verifyPassword, updateProfile, updatePassword, requestOtp, verifyOtp };

