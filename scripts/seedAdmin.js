require("dotenv").config();

const mongoose = require("mongoose");

const userMongoModel = require(
  "../src/models/userMongoModel"
);

async function main() {
  await mongoose.connect(
    process.env.MONGODB_URI
  );

  const email =
    process.env.ADMIN_EMAIL ||
    "admin@harson.local";

  const password =
    process.env.ADMIN_PASSWORD ||
    "HarsonAdmin123!";

  const existing =
    await userMongoModel.findByEmail(
      email
    );

  if (existing) {
    console.log(
      `Admin already exists: ${email}`
    );

    return;
  }

  await userMongoModel.createUser({
    name: "HARSON Admin",
    email,
    password,
    role: "admin"
  });

  console.log(
    "Admin account created successfully."
  );

  console.log(
    `Email: ${email}`
  );

  console.log(
    `Password: ${password}`
  );

  console.log(
    "Change this password policy before production deployment."
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });