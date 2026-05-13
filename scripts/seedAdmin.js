require("dotenv").config();

const userCsvModel = require("../src/models/userCsvModel");

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@harson.local";
  const password = process.env.ADMIN_PASSWORD || "HarsonAdmin123!";

  const existing = await userCsvModel.findByEmail(email);

  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  await userCsvModel.createUser({
    name: "HARSON Admin",
    email,
    password,
    role: "admin"
  });

  console.log("Admin account created successfully.");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log("Change this password policy before production deployment.");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
