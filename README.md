# HARSON Project

Modular Node.js + Express + MVVM-style frontend application converted from the HARSON static HTML page.

## Run

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Development

```bash
npm run dev
```

## Account storage

Users are stored in:

```text
data/users.secure.csv
```

Passwords are stored as bcrypt hashes, not plain text.

## Important

Before production, change `JWT_SECRET` in `.env`.
