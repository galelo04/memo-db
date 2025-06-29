import { tryParse } from '../utilis/commandUtilis.ts'
import type { tryParseResult } from '../utilis/commandUtilis.ts'
import { RedisStore } from '../utilis/redisStore.ts'
import { formatResponse, ResponseType } from '../utilis/responseUtilis.ts'
import type { Response } from '../utilis/responseUtilis.ts'
import net from 'net'
let store = new RedisStore()
function isValidCommand(command: string): boolean {
  return (command === "SET" || command === "GET" || command === "DEL" || command === "EXPIRE" || command === "CONFIG")
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
function handleConfigGet(command: string[]): Response {
  store.getConfig(command[1])
}
async function handleCommand(command: string[]): Promise<Response> {
  if (!isValidCommand(command[0].toUpperCase())) {
    throw { type: ResponseType.error, data: `unknown command ${command[0]}` };
  }

  switch (command[0].toUpperCase()) {
    case "SET":
      return handleSET(command);
    case "GET":
      return handleGET(command);
    case "DEL":
      return handleDEL(command);
    case "EXPIRE":
      return handleEXPIRE(command);
    default:
      throw { type: ResponseType.error, data: `unknown command ${command[0]}` };
  }
}
const server = net.createServer((socket) => {

  let buffer = Buffer.alloc(0)
  async function processBuffer() {
    while (true) {
      let response: Response

      const result: tryParseResult = tryParse(buffer);
      if (result.error) {
        response = { type: ResponseType.error, data: [`${result.error}`] }
        break;
      }
      if (result.parsedCommand === null) {
        break;
      }
      buffer = result.remainingBuffer;
      try {
        response = await handleCommand(result.parsedCommand);
        store.print()
      } catch (err: any) {
        response = { type: ResponseType.error, data: [`${err.message || err}`] }
      }
      socket.write(formatResponse(response))
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
