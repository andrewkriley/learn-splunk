FROM node:20-alpine

ARG SPLUNK_MCP_SERVER2_REF=fac6cbb37be057a68607642d8d60d9c19ba5a060

RUN apk add --no-cache git
RUN git clone https://github.com/splunk/splunk-mcp-server2 /app \
  && cd /app \
  && git checkout "${SPLUNK_MCP_SERVER2_REF}"

WORKDIR /app/typescript

RUN npm install

COPY server.ts /app/typescript/server.ts
COPY splunkClient.ts /app/typescript/splunkClient.ts

EXPOSE 8050

CMD ["npx", "ts-node", "server.ts"]
