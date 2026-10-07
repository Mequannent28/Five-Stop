const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ── Startup diagnostics ────────────────────────────────────────────────
console.log('[STARTUP] NODE_ENV:', process.env.NODE_ENV);
console.log('[STARTUP] PORT:', process.env.PORT);
console.log('[STARTUP] MONGO_URI set:', !!process.env.MONGO_URI);
console.log('[STARTUP] JWT_SECRET set:', !!process.env.JWT_SECRET);

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

connectDB();

// ── Auto-seed default accounts on startup ─────────────────────────────
const autoSeed = async () => {
  try {
    const User = require('./models/User');
    const defaults = [
      { name: 'Hotel Admin',   email: 'admin@hotel.com',       password: 'admin123', role: 'admin'       },
      { name: 'Hotel Manager', email: 'manager@hotel.com',     password: 'admin123', role: 'manager'     },
      { name: 'Store Keeper',  email: 'storekeeper@hotel.com', password: 'admin123', role: 'storekeeper' },
    ];
    for (const u of defaults) {
      const exists = await User.findOne({ email: u.email });
      if (!exists) {
        await User.create(u);
        console.log(`[SEED] Created ${u.role} -> ${u.email}`);
      }
    }
  } catch (err) {
    console.error('[SEED] Auto-seed error:', err.message);
  }
};
autoSeed();

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Ensure DB is connected for serverless requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'hotel-stock-server' }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/materials', require('./routes/materialRoutes'));
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/inventory-count', require('./routes/inventoryCountRoutes'));

// Serve Frontend in production (for Aletcloud, Render, etc.)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  // Exclude /api routes from being caught by the wildcard
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/dist', 'index.html'));
  });
} else {
  app.get('/', (req, res) => res.send('Please set to production'));
}

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Listen on port unless we are in Vercel's serverless environment
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
