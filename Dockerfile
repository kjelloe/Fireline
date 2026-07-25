# More Firepower server (slice 4E). Runs the authoritative server + client.
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY shared ./shared
COPY engine ./engine
COPY server ./server
COPY client ./client
COPY data ./data
EXPOSE 8080
ENV PORT=8080
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://localhost:8080/health || exit 1
CMD ["node", "server/index.js"]
