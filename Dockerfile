FROM node:20-alpine

WORKDIR /app

# Install deps first (cached layer — only re-runs when package.json changes)
COPY package*.json ./
RUN npm ci --only=production

# Then copy your code
COPY . .

EXPOSE 3000

# Don't run as root
USER node

CMD ["node", "server.js"]