FROM node

WORKDIR /usr/src/app 


COPY package*.json ./

RUN npm install


COPY . .

EXPOSE 6379

ENTRYPOINT [ "npx","ts-node"]

CMD ["./src/server.ts"]
