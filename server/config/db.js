const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/adaptive-quiz');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`\n=============================================================`);
    console.error(`⚠️  DATABASE CONNECTION WARNING`);
    console.error(`=============================================================`);
    console.error(`Could not connect to MongoDB: ${error.message}`);
    console.error(`Please ensure:`);
    console.error(`1. MongoDB is installed and running locally on port 27017.`);
    console.error(`2. Or configure a remote MONGODB_URI in the 'server/.env' file.`);
    console.error(`=============================================================\n`);
  }
};

module.exports = connectDB;
