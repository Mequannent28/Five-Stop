const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Check if we are already connected (useful for Vercel serverless)
    if (mongoose.connections[0].readyState) {
      console.log('MongoDB already connected');
      return;
    }

    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error('FATAL: MONGO_URI environment variable is not set. Please add it to your hosting platform environment variables.');
      console.error('Required env vars: MONGO_URI, JWT_SECRET, NODE_ENV, PORT');
      throw new Error('MONGO_URI environment variable is missing. Configure it in your hosting provider dashboard.');
    }

    const conn = await mongoose.connect(uri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;

