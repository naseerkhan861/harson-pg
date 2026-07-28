// Connectivity check for the HARSON MongoDB (Atlas) connection.
// Uses mongoose — the same connection path as src/db.js — so this verifies
// the real connection the app uses, not a separate raw-driver path.

// Polyfill Web Crypto global (see src/db.js for rationale).
if (!globalThis.crypto) {
  globalThis.crypto = require("crypto").webcrypto;
}

require("dotenv").config();
const mongoose = require("mongoose");

// Honor the same optional DNS override as src/db.js for networks where
// *.mongodb.net is DNS-poisoned.
const dnsServers = process.env.MONGO_DNS_SERVERS;
if (dnsServers) {
  require("dns").setServers(
    dnsServers.split(",").map((s) => s.trim()).filter(Boolean)
  );
}

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("FAILED: MONGODB_URI is not set. Check your .env file.");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("STEP 1: Connected to Atlas");

    const ping = await mongoose.connection.db.admin().ping();
    console.log("STEP 2: Ping response:", ping.ok);

    await mongoose.disconnect();
    console.log("STEP 3: Closed cleanly. ALL GOOD!");
  } catch (e) {
    console.error("FAILED:", e.stack || e.message);
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
})();
