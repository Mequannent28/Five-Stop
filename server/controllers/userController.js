const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const tg  = require('../utils/telegramNotifier');

const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password').sort({ createdAt: -1 });
  res.json(users);
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404); throw new Error('User not found'); }

  const wasActive = user.isActive;
  const oldRole   = user.role;

  user.name     = req.body.name     ?? user.name;
  user.role     = req.body.role     ?? user.role;
  user.isActive = req.body.isActive ?? user.isActive;
  if (req.body.password) user.password = req.body.password;

  const updated = await user.save();

  // Notify: account enabled / disabled
  if (req.body.isActive !== undefined && req.body.isActive !== wasActive) {
    tg.notifyUserStatusChanged(updated, req.body.isActive ? 'enabled' : 'disabled', req.user);
  }
  // Notify: role changed
  if (req.body.role !== undefined && req.body.role !== oldRole) {
    tg.notifyUserRoleChanged(updated, oldRole, req.body.role, req.user);
  }

  res.json({
    _id:      updated._id,
    name:     updated.name,
    email:    updated.email,
    role:     updated.role,
    isActive: updated.isActive,
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404); throw new Error('User not found'); }
  tg.notifyUserDeleted(user, req.user);
  await user.deleteOne();
  res.json({ message: 'User removed' });
});

module.exports = { getUsers, updateUser, deleteUser };
