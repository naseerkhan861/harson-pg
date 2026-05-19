# HARSON Modular MVVM Node Application

This project converts the original static HARSON HTML page into a modular Node.js + Express + browser-side MVVM application.

## Main features

- Static HARSON homepage preserved with working image, icons, buttons, anchor links and CL-AIGC external link.
- CL-Base user registration and login.
- Passwords stored as bcrypt hashes, not plain text.
- HTTP-only JWT login cookie.
- User authentication data stored in MongoDB Atlas.
- AIGC enterprise master account management.
- AIGC sub-account management.
- Shared enterprise credit pool.
- One-to-one CL-Base account to AIGC sub-account mapping.
- User creative-work isolation by mapped AIGC sub-account.

## Run locally

### 1. Install dependencies

```bash
npm install
```

On Windows PowerShell, if `npm.ps1` is blocked, use:

```powershell
npm.cmd install
```

### 2. Create local environment file

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
copy .env.example .env
```

Then open `.env` and fill in the required values:

```env
PORT=3000
JWT_SECRET=change-this-to-a-long-random-secret-key
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database-name>?appName=<app-name>
```

The real `.env` file is ignored by Git and should not be committed.

### 3. Configure MongoDB Atlas

This project uses MongoDB Atlas as the cloud database for user authentication. A local MongoDB installation is not required.

The MongoDB connection string must be configured in the local `.env` file as `MONGODB_URI`.

For team development, ask the team lead for the shared MongoDB Atlas development connection string.

For independent setup, create a MongoDB Atlas database, then get the connection string from:

```text
MongoDB Atlas → Database → Connect → Drivers → Node.js
```

Replace the placeholders in `MONGODB_URI`:

```text
<username>       MongoDB database username
<password>       MongoDB database password
<cluster-url>    MongoDB Atlas cluster URL
<database-name>  MongoDB database name, for example intern_login_demo
<app-name>       Optional Atlas app name
```

For local development, make sure your current IP address is allowed in MongoDB Atlas:

```text
MongoDB Atlas → Security → Network Access → Add IP Address
```

### 4. Start the app

```bash
npm run dev
```

Or:

```bash
npm start
```

If MongoDB is configured correctly, the terminal should show:

```text
MongoDB connected successfully
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

## Data storage

User authentication data is stored in MongoDB Atlas.

Some legacy or non-authentication project features may still use secure CSV files stored in `data/`, such as AIGC account management data.

Example CSV files:

```text
data/aigc_master_accounts.secure.csv
data/aigc_sub_accounts.secure.csv
data/account_mappings.secure.csv
data/creative_works.secure.csv


These files are ignored by Git and should not be placed inside `public/`.







## Test authentication

Register a dummy user:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Dummy User","email":"dummy@example.com","password":"password123"}'
```

Login with the dummy user:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dummy@example.com","password":"password123"}'
```

Test failed login with a wrong password:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dummy@example.com","password":"wrongpassword"}'
```

Passwords are hashed with `bcryptjs` before being stored in MongoDB. The plain text password is never saved.


## Workflow

1. `git checkout main && git pull` — sync first, always
2. `git checkout -b feature/your-task` — branch before coding
3. Code, commit often with clear messages
4. `git push -u origin feature/your-task`
5. Open a Pull Request on GitHub
6. Wait for review and approval before merging

## Never commit

- `.env` (use `.env.example` as a template)
- `Any real CSV data files in `data/`
- `node_modules/`

If unsure, check `.gitignore` or ask in #dev chat.