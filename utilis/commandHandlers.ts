import type { KeyValueStore } from './storeInterface.ts'
import { ResponseType } from './responseUtilis.ts'
import type { Response } from './responseUtilis.ts'
import { RedisServerInfo } from './RedisServerInfo.ts';
import type { SocketInfo } from './RedisServerInfo.ts';
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
  "MULTI",
  "EXEC",
  "DISCARD"
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
  function handleMULTI(command: string[], socketInfo: SocketInfo): Response {

    if (socketInfo.isTransaction) {
      return { type: ResponseType.error, data: ["There is a Transaction already activated use EXEC to execute transaction or DISCARD to discard it instead"] }
    }
    socketInfo.isTransaction = true;
    return { type: ResponseType.simpleString, data: ["OK"] }
  }
  async function handleEXEC(command: string[], socketInfo: SocketInfo): Promise<Response> {
    if (!socketInfo.isTransaction) {
      return { type: ResponseType.error, data: ["EXEC without MULTI"] }
    }
    socketInfo.isTransaction = false;
    const execResult: Response[] = []
    for (const command of socketInfo.commandsQueue) {
      execResult.push(await handleCommand(command, socketInfo))
    }
    socketInfo.commandsQueue = []
    return { type: ResponseType.array, data: execResult }
  }
  function handleDISCARD(command: string[], socketInfo: SocketInfo): Response {
    if (!socketInfo.isTransaction) {
      return { type: ResponseType.error, data: ["DISCARD without MULTI"] }
    }
    socketInfo.isTransaction = false;
    socketInfo.commandsQueue = []
    return { type: ResponseType.simpleString, data: ["OK"] }
  }
  async function handleCommand(command: string[], socketInfo: SocketInfo): Promise<Response> {
    if (socketInfo.isTransaction && command[0].toUpperCase() !== "EXEC" && command[0].toUpperCase() !== "DISCARD" && command[0].toUpperCase() !== "MULTI") {
      socketInfo.commandsQueue.push(command)
      return { type: ResponseType.simpleString, data: ["QUEUED"] }
    }
    if (!isValidCommand(command[0].toUpperCase())) {
      return { type: ResponseType.error, data: [`unknown command ${command[0]}`] };
    }
    if (isWriteCommand(command[0].toUpperCase()) && serverInfo.role === "replica" && socketInfo.requesterType === "client") {
      return { type: ResponseType.error, data: ["READONLY"] };
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
      case "MULTI":
        return handleMULTI(command, socketInfo);
      case "EXEC":
        return handleEXEC(command, socketInfo);
      case "DISCARD":
        return handleDISCARD(command, socketInfo)
      default:
        return { type: ResponseType.error, data: [`unknown command ${command[0]}`] };
    }
  }
  return { handleCommand }
}
