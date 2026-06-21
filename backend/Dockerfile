FROM node:20-alpine

WORKDIR /app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm install --production

# Copy source code and data
COPY . .

# Expose backend port
EXPOSE 3001

CMD ["node", "src/index.js"]
