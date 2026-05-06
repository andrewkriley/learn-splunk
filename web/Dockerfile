FROM node:20-alpine

RUN apk add --no-cache docker-cli docker-cli-compose python3

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./server.js
COPY public ./public

ENV PORT=3000
ENV LAB_ROOT=/workspace

EXPOSE 3000

CMD ["npm", "start"]
