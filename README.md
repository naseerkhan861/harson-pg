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







## Setup

```bash
git clone https://github.com/your-username/harson-pg.git
cd harson-pg
npm install
cp .env.example .env       # then fill in values (ask team lead)
npm run setup              # creates local data/users.csv from seed
npm start
```

Open http://localhost:3000

## Test login

Email: `test@example.com`
Password: `password123`

## Workflow

1. `git checkout main && git pull` — sync first, always
2. `git checkout -b feature/your-task` — branch before coding
3. Code, commit often with clear messages
4. `git push -u origin feature/your-task`
5. Open a Pull Request on GitHub
6. Wait for review and approval before merging

## Never commit

- `.env` (use `.env.example` as a template)
- `data/users.csv` or any real CSV
- `node_modules/`

If unsure, check `.gitignore` or ask in #dev chat.