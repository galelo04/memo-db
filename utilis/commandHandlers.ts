import type { KeyValueStore } from './storeInterface.ts'
import { ResponseType } from './responseUtilis.ts'
import type { Response } from './responseUtilis.ts'
import { RedisServerInfo } from './RedisServerInfo.ts';
const validCommands = new Set([
  "SET",
  "GET",
  "DEL",
  "EXPIRE",
  "CONFIG",
  "INFO",
  "PING",
  "REPLCONF",
  "PSYNC",
]);
const writeCommands = new Set([
  "SET",
  "DEL",
  "EXPIRE"
])

function isValidCommand(command: string): boolean {
  return validCommands.has(command);
}
export function isWriteCommand(command: string): boolean {
  return writeCommands.has(command)
}
export function createCommandHandlers(store: KeyValueStore, serverInfo: RedisServerInfo) {
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
      return { type: ResponseType.bulkString, data: [entry] }
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


        result.push({ type: ResponseType.bulkString, data: [command[i]] })
        result.push({ type: ResponseType.bulkString, data: [config] })
      }
    }
    return { type: ResponseType.map, data: result }
  }
  function handleConfigSet(command: string[]): Response {
    store.setConfig(command[2], command[3])
    return { type: ResponseType.simpleString, data: ["OK"] }
  }
  function handleINFO(command: string[]): Response {
    const lines = [`role:${serverInfo.role}`,
    `port:${serverInfo.port}`,
    `master_replid:${serverInfo.master_replid}`,
    `master_repl_offset:${serverInfo.master_repl_offset}`]
    const info = lines.join('\n')
    return { type: ResponseType.bulkString, data: [info] }
  }
  function handlePING(command: string[]): Response {
    return { type: ResponseType.simpleString, data: ["PONG"] }
  }
  function handleREPLCONF(command: string[]): Response {
    return { type: ResponseType.simpleString, data: ["OK"] }
  }
  function handlePSYNC(command: string[]): Response {
    return { type: ResponseType.simpleString, data: [`FULLRESYNC ${serverInfo.master_replid} ${serverInfo.master_repl_offset}`] }
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
      case "INFO":
        return handleINFO(command)
      case "PING":
        return handlePING(command)
      case "REPLCONF":
        return handleREPLCONF(command)
      case "PSYNC":
        return handlePSYNC(command)
      default:
        throw { type: ResponseType.error, data: `unknown command ${command[0]}` };
    }
  }
  return { handleCommand }
}
