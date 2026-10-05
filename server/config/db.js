const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Check if we are already connected (useful for serverless)
    if (mongoose.connections[0].readyState) {
      return;
    }

    // Try multiple env var names (different platforms use different names)
    const uri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      process.env.MONGO_URL ||
      process.env.DATABASE_URL;

    if (!uri) {
      console.error('FATAL: No MongoDB connection string found.');
      console.error('Checked: MONGO_URI, MONGODB_URI, MONGO_URL, DATABASE_URL');
      throw new Error('MongoDB connection string is missing. Set MONGO_URI in environment variables.');
    }

    const conn = await mongoose.connect(uri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
