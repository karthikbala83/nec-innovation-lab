// Single place for the DB connection. Used by server.js, the seed and the daily job.
// MONGO_DB_NAME picks the database even when the Atlas URI has no "/<db>" path
// (Atlas "Connect" strings usually don't — without it data lands in "test").
const dns = require('dns');
const mongoose = require('mongoose');

// Some home/college routers refuse the SRV lookups that "mongodb+srv://" needs
// (error: querySrv ECONNREFUSED). DNS_SERVERS=1.1.1.1,8.8.8.8 works around it locally.
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));

const connectOptions = () => ({
  dbName: process.env.MONGO_DB_NAME || undefined,   // undefined = use the name in the URI
  serverSelectionTimeoutMS: 15000,
});

const connect = () => mongoose.connect(process.env.MONGO_URI, connectOptions());

const connectDB = async () => {
  try {
    const conn = await connect();
    console.log(`MongoDB connected: ${conn.connection.host} / ${conn.connection.name}`);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.connect = connect;
