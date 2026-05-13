# HARSON Modular MVVM Node Application

This project converts the original static HARSON HTML page into a modular Node.js + Express + browser-side MVVM application.

## Main features

- Static HARSON homepage preserved with working image, icons, buttons, anchor links and CL-AIGC external link.
- CL-Base user registration and login.
- Passwords stored as bcrypt hashes, not plain text.
- HTTP-only JWT login cookie.
- Secure CSV files stored outside the public folder.
- AIGC enterprise master account management.
- AIGC sub-account management.
- Shared enterprise credit pool.
- One-to-one CL-Base account to AIGC sub-account mapping.
- User creative-work isolation by mapped AIGC sub-account.

## Run

```bash
npm install
npm start
```

On Windows PowerShell, if npm.ps1 is blocked, use:

```powershell
npm.cmd install
npm.cmd start
```

Open:

```text
http://localhost:3000
```

## Seed an admin account

```bash
npm run seed:admin
```

Default admin:

```text
Email: admin@harson.local
Password: HarsonAdmin123!
```

For production, change these values through environment variables before seeding:

```env
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=your-strong-password
```

## Pages

```text
/                   Homepage
/login              Login and register
/account-management AIGC account center
```

## CSV files

The secure CSV files are created automatically in `data/`:

```text
data/users.secure.csv
data/aigc_master_accounts.secure.csv
data/aigc_sub_accounts.secure.csv
data/account_mappings.secure.csv
data/creative_works.secure.csv
```

These files are ignored by Git and should not be placed inside `public/`.
