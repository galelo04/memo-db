import { tryParse, parseAOFFile, isValidCommand } from '../utilis/commandUtilis.ts'
import type { tryParseResult } from '../utilis/commandUtilis.ts'
import { RedisStore } from '../utilis/redisStore.ts'
import { formatResponse, ResponseType } from '../utilis/responseUtilis.ts'
import type { Response } from '../utilis/responseUtilis.ts'
import net from 'net'
import { promises as fsPromises, read } from 'fs'
import { readFileSync } from 'fs'
import { join } from 'path'
import { error } from 'console'
let store = new RedisStore()
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
    return { type: ResponseType.bulkString, data: [entry.length.toString(), entry] }
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
  let result: Response[] = []
  for (let i = 2; i < command.length; i++) {
    let config = store.getConfig(command[i]);
    if (config) {


      result.push({ type: ResponseType.bulkString, data: [command[i].length.toString(), command[i]] })
      result.push({ type: ResponseType.bulkString, data: [config.length.toString(), config] })
    }
  }
  return { type: ResponseType.map, data: result }
}
function handleConfigSet(command: string[]): Response {
  store.setConfig(command[2], command[3])
  return { type: ResponseType.simpleString, data: ["OK"] }
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
    case "CONFIG":
      if (command[1].toUpperCase() === "SET")
        return handleConfigSet(command)
      else if (command[1].toUpperCase() === "GET")
        return handleConfigGet(command)
    default:
      throw { type: ResponseType.error, data: `unknown command ${command[0]}` };
  }
}
const server = net.createServer((socket) => {

  let buffer = Buffer.alloc(0)
  async function processBuffer() {
    while (true) {
      let response: Response
      if (buffer.length <= 0) {
        break;
      }

      const result: tryParseResult = tryParse(buffer);
      if (result.error) {
        response = { type: ResponseType.error, data: [`${result.error}`] }
        break;
      }
      if (!result.parsedCommand) {
        break;
      }
      if (result.fullCommandText) {
        let AOFFileName = store.getConfig('aof-fileName');
        let AOFdir = store.getConfig('dir')
        if (AOFFileName && AOFdir) {
          fsPromises.appendFile(join(AOFdir, AOFFileName), result.fullCommandText)
        }
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
