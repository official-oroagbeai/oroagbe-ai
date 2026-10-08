# api/Dockerfile
FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application
COPY . .

# Expose the Express port
EXPOSE 5000

# Start the server (Assumes your main file is named server.js or index.js)
# If your package.json has a "start" script, you can use CMD ["npm", "start"]
CMD ["node", "index.js"]