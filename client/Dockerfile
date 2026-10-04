FROM node:20-slim

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start Vite with --host 0.0.0.0 for Docker networking
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
