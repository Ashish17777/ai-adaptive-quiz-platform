const mongoose = require('mongoose');

let mongoMemoryServer = null;

const connectDB = async () => {
  const primaryUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/adaptive-quiz';

  // 1. Try connecting to configured MongoDB (Atlas or local) with a 3-second timeout
  try {
    const conn = await mongoose.connect(primaryUri, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return;
  } catch (error) {
    console.warn(`\n⚠️ Primary MongoDB connection failed (${error.message}).`);
    console.warn(`⚡ Starting in-memory MongoMemoryServer database fallback...\n`);
  }

  // 2. Fallback to MongoMemoryServer
  try {
    await mongoose.disconnect();
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoMemoryServer = await MongoMemoryServer.create();
    const memoryUri = mongoMemoryServer.getUri();

    const conn = await mongoose.connect(memoryUri);
    console.log(`✅ In-Memory MongoDB Connected successfully: ${conn.connection.host}`);
  } catch (memError) {
    console.error(`❌ Failed to connect to MongoDB memory server: ${memError.message}`);
  }
};

module.exports = connectDB;

