FROM node:20 AS builder
WORKDIR /usr/src/app

COPY package*.json tsconfig.json ./
RUN npm install

COPY . .
RUN npm run build  

FROM node:20-slim
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/dist ./dist
COPY package*.json ./

RUN npm install --omit=dev  

RUN mkdir dir
RUN touch ./dir/aof.txt ./dir/replication.txt

EXPOSE 6379

CMD ["node", "./dist/src/server.js"]

