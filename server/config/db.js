const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Check if we are already connected (useful for serverless environments)
    if (mongoose.connection.readyState >= 1) {
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
      throw new Error('Database configuration missing: MONGO_URI environment variable is not set on the server.');
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4 to prevent cloud IPv6 connection timeouts
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    if (error.name === 'MongooseServerSelectionError' || error.message.includes('Server selection timed out')) {
      throw new Error(
        'Database connection timed out. Please ensure MongoDB Atlas Network Access allows 0.0.0.0/0 (Access from Anywhere).'
      );
    }
    throw error;
  }
};

module.exports = connectDB;
