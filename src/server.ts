import { tryParse } from '../utilis/commandUtilis.ts'
import type { tryParseResult } from '../utilis/commandUtilis.ts'
import { RedisStore } from '../utilis/redisStore.ts'
import { formatResponse, ResponseType } from '../utilis/responseUtilis.ts'
import type { Response } from '../utilis/responseUtilis.ts'
import net from 'net'
let buffer = Buffer.alloc(0)
let store = new RedisStore()
function isValidCommand(command: string): boolean {
  return (command === "SET" || command === "GET" || command === "DEL" || command === "EXPIRE")
}
function handleSET(command: string[]): Response {
  if (command.length === 3) {
    store.insertEntry(command[1], command[2])
  }
  else if (command.length === 5) {
    const now = new Date();
    const secondsToAdd = Number(command[4]);

    const expireDate = new Date(now.getTime() + secondsToAdd * 1000);
    store.insertEntry(command[1], command[2], expireDate)
  }
  return { type: ResponseType.simpleString, data: ["OK"] }
}
function handleGET(command: string[]): Response {
  const entry = store.getValue(command[1])
  if (entry) {
    return { type: ResponseType.bulkString, data: [entry.length, entry] }
  }
  else {
    return { type: ResponseType.null, data: [] }
  }
}

function handleDEL(command: string[]): Response {

  let count = 0;
  for (let i = 1; i < command.length; i++) {

    count += store.deleteEntry(command[i])
  }
  return { type: ResponseType.integer, data: [count.toString()] }
}
function handleEXPIRE(command: string[]): Response {
  const now = new Date();
  const secondsToAdd = Number(command[2]);

  const expireDate = new Date(now.getTime() + secondsToAdd * 1000);
  const expireResult = store.expireEntry(command[1], expireDate);
  return { type: ResponseType.integer, data: [expireResult.toString()] }
}
function handleCommand(command: string[]): Promise<Response> {

  return new Promise((resolve, reject) => {

    if (isValidCommand(command[0].toUpperCase())) {
      switch (command[0].toUpperCase()) {
        case "SET":
          return resolve(handleSET(command))

        case "GET":
          return resolve(handleGET(command))

        case "DEL":
          return resolve(handleDEL(command))
        case "EXPIRE":
          return resolve(handleEXPIRE(command))
      }
    }
    reject(`-ERR unknown command${command[0]}`)
  })
}
const server = net.createServer((socket) => {

  async function processBuffer() {
    while (true) {
      const result: tryParseResult = tryParse(buffer);
      if (result.error) {
        socket.write(`-${result.error}\r\n`);
        break;
      }
      if (result.parsedCommand === null) {
        break;
      }
      buffer = result.remainingBuffer;
      try {
        const response = await handleCommand(result.parsedCommand);
        const formatedResponse = formatResponse(response)
        store.print()
        socket.write(formatedResponse);
      } catch (err: any) {
        socket.write(`-ERR ${err.message || err}\r\n`);
      }
    }
  }
  console.log('client connected');
  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data])
    processBuffer()
  })
})

server.listen(8080, () => {
  console.log('server listening on port 8080');
});
