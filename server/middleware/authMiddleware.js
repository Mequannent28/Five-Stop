const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Setting = require('../models/Setting');

const DEFAULT_ROLE_PERMISSIONS = {
  recordGoods: { storekeeper: true, manager: true, admin: true },
  checkReview: { storekeeper: false, manager: true, admin: true },
  approveGoods: { storekeeper: false, manager: false, admin: true },
  postLedger: { storekeeper: false, manager: true, admin: true },
  voidTransactions: { storekeeper: false, manager: false, admin: true },
  viewReports: { storekeeper: false, manager: true, admin: true },
  manageAccounts: { storekeeper: false, manager: false, admin: true },
};

let cachedSettings = null;
let lastSettingsFetch = 0;

const getCachedRolePermissions = async () => {
  const now = Date.now();
  if (!cachedSettings || now - lastSettingsFetch > 5000) {
    try {
      cachedSettings = await Setting.findOne();
      lastSettingsFetch = now;
    } catch (err) {
      console.error('Error fetching settings in authMiddleware:', err);
    }
  }
  return cachedSettings?.rolePermissions || DEFAULT_ROLE_PERMISSIONS;
};

const clearSettingsCache = () => {
  cachedSettings = null;
  lastSettingsFetch = 0;
};

const hasPermission = async (role, capability) => {
  if (!role) return false;
  const rolePermissions = await getCachedRolePermissions();
  if (role === 'admin') {
    const adminPerm = rolePermissions?.[capability]?.admin;
    return adminPerm !== false;
  }
  return Boolean(rolePermissions?.[capability]?.[role]);
};

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user || !req.user.isActive) {
        res.status(401);
        throw new Error('Not authorized, account inactive or not found');
      }
      return next();
    } catch (error) {
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  }

  res.status(401);
  throw new Error('Not authorized, no token provided');
});

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403);
      throw new Error(`Role '${req.user ? req.user.role : 'guest'}' is not permitted to perform this action`);
    }
    next();
  };
};

const authorizePermission = (capability) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized, no user found');
    }
    const permitted = await hasPermission(req.user.role, capability);
    if (!permitted) {
      res.status(403);
      throw new Error(`Your role '${req.user.role}' is not permitted to perform this action (${capability})`);
    }
    next();
  });
};

module.exports = {
  protect,
  authorize,
  authorizePermission,
  hasPermission,
  clearSettingsCache,
  getCachedRolePermissions,
  DEFAULT_ROLE_PERMISSIONS,
};

