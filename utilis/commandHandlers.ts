import type { KeyValueStore } from '../models/StoreInterface.js'
import { ResponseType } from './responseUtilis.js'
import type { Response } from './responseUtilis.js'
import { MemoServerInfo } from '../models/MemoServerInfo.js';
import type { SocketInfo } from '../models/MemoServerInfo.js';
import { EntryType } from '../models/StoreInterface.js';
import { StoreEntry } from '../models/MemoStore.js';
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
  "DISCARD",
  "INCR",
  "DECR"
]);
const writeCommands = new Set([
  "SET",
  "DEL",
  "EXPIRE",
  "INCR",
  "DECR"
])

function isValidCommand(command: string): boolean {
  return validCommands.has(command);
}
export function isWriteCommand(command: string): boolean {
  return writeCommands.has(command)
}
export function createCommandHandlers(store: KeyValueStore, serverInfo: MemoServerInfo) {
  function handleSET(command: string[]): Response {
    if (command.length === 3) {
      store.insertEntry(command[1], command[2], 'string')
    }
    else if (command.length === 5) {
      const now = new Date();
      let milliSecondsToAdd;
      if (command[3].toUpperCase() === "EX") {
        milliSecondsToAdd = Number(command[4]) * 1000;
      } else if (command[3].toUpperCase() === "PX") {
        milliSecondsToAdd = Number(command[4])
      } else {
        return { type: ResponseType.error, data: [`Unsupported percision ${command[3]}`] }
      }

      const expireDate = new Date(now.getTime() + milliSecondsToAdd);
      store.insertEntry(command[1], command[2], 'string', expireDate)
    }
    return { type: ResponseType.simpleString, data: ["OK"] }
  }
  function handleGET(command: string[]): Response {
    const entry: StoreEntry | undefined = store.getEntry(command[1])
    if (entry) {
      if (entry.type !== 'string') {
        return { type: ResponseType.error, data: ["WRONGTYPE Operation against a key holding the wrong kind of value"] }
      }

      return { type: ResponseType.bulkString, data: [entry.value] }
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
    const lines = [`role: ${serverInfo.role}`,
    `port: ${serverInfo.port}`]
    if (serverInfo.role === 'master') {
      lines.push(`#replicas: ${serverInfo.replicas.size}`)
    } else {
      lines.push(`master_replid: ${serverInfo.master_repl_id}`)
      lines.push(`master_repl_offset: ${serverInfo.master_repl_offset}`)
      lines.push(`master_details\r\nmaster_port: ${serverInfo.master_port}\r\nmaster_host: ${serverInfo.master_host} `)
    }
    const info = lines.join('\r\n')
    return { type: ResponseType.bulkString, data: [info] }
  }

  function handlePING(command: string[]): Response {
    return { type: ResponseType.simpleString, data: ["PONG"] }
  }

  function handleREPLCONF(command: string[]): Response {
    return { type: ResponseType.simpleString, data: ["OK"] }
  }

  function handlePSYNC(command: string[]): Response {
    return { type: ResponseType.simpleString, data: [`FULLRESYNC ${serverInfo.master_repl_id} ${serverInfo.master_repl_offset}`] }
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

  function handleINCR(command: string[]): Response {
    const entry: StoreEntry | undefined = store.getEntry(command[1]);
    if (entry) {
      if (entry.type !== 'string' || Number.isFinite(parseFloat(entry.value))) {
        return { type: ResponseType.error, data: ["value is not an integer or out of range"] }
      }
      const newValue = parseFloat(entry.value) + 1
      store.updateEntry(command[1], newValue.toString(), entry.type)
      return { type: ResponseType.integer, data: [newValue.toString()] }
    }
    store.insertEntry(command[1], "1", 'string')
    return { type: ResponseType.integer, data: ["1"] }
  }

  function handleDECR(command: string[]): Response {
    const entry: StoreEntry | undefined = store.getEntry(command[1]);
    if (entry) {
      if (entry.type !== 'string' || Number.isFinite(parseFloat(entry.value))) {
        return { type: ResponseType.error, data: ["value is not an integer or out of range"] }
      }
      const newValue = parseFloat(entry.value) - 1
      store.updateEntry(command[1], newValue.toString(), entry.type)
      return { type: ResponseType.integer, data: [newValue.toString()] }
    }
    store.insertEntry(command[1], "0", 'string')
    return { type: ResponseType.integer, data: ["0"] }
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
      case "INCR":
        return handleINCR(command)
      case "DECR":
        return handleDECR(command)
      default:
        return { type: ResponseType.error, data: [`unknown command ${command[0]}`] };
    }
  }
  return { handleCommand }
}
