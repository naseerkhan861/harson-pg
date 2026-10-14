// Polyfill the Web Crypto global for the mongodb driver's randomBytes() helper.
// Node < 19 exposes globalThis.crypto only in the REPL/eval context, not in
// regular script files — without this, the SCRAM handshake throws
// "crypto is not defined" when the app runs via `node server.js`.
if (!globalThis.crypto) {
  globalThis.crypto = require("crypto").webcrypto;
}

const mongoose = require("mongoose");

// Optional: override DNS resolvers on networks where *.mongodb.net is poisoned
// (e.g. some mainland-China ISPs). Set MONGO_DNS_SERVERS=8.8.8.8,1.1.1.1 in .env
// to enable; leave unset in environments with clean DNS (production).
const dnsServers = process.env.MONGO_DNS_SERVERS;
if (dnsServers) {
  require("dns").setServers(
    dnsServers.split(",").map((s) => s.trim()).filter(Boolean)
  );
}

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

module.exports = connectDB;