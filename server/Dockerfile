FROM node:20-slim

# Install OpenSSL for Prisma engine compatibility
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm install
RUN npx prisma generate

# Copy the rest of the application code
COPY . .

# Expose backend API port
EXPOSE 3001

# Run Prisma schema push to ensure DB is migrated, then start backend server
CMD ["sh", "-c", "npx prisma generate && npx prisma db push && node src/server.js"]
