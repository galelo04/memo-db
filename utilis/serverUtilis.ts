import { tryParse, parseAOFFile } from '../utilis/commandParsing.js'
import type { ParseResult } from '../utilis/commandParsing.js'
import { MemoStore } from '../models/MemoStore.js'
import type { Response } from '../utilis/responseUtilis.js'
import net, { Socket } from 'net'
import { MemoServerInfo, MemoServerInfoBuilder } from '../models/MemoServerInfo.js'
import type { SocketInfo } from '../models/MemoServerInfo.js'
import { encodeCommand } from '../utilis/commandEncoding.js'
import { promises as fsPromises } from 'fs'
import { isWriteCommand } from './commandHandlers.js'
interface ParsingResult {
  remainingBuffer: Buffer,
  parsingResults: ParseResult[]
}
type MasterReplicaState = "HANDSHAKE_PING" | "HANDSHAKE_REPLCONF1" | "HANDSHAKE_REPLCONF2" | "HANDSHAKE_PSYNC" | "HANDSHAKE_COMPLETE" | "WRITE";
export async function connectToMaster(memoServerInfo: MemoServerInfo, store: MemoStore, handleCommand: (command: string[], socketInfo: SocketInfo) => Promise<Response>, socketInfo: SocketInfo) {
  let currentState: MasterReplicaState;
  const replica = net.createConnection({ port: memoServerInfo.master_port, host: memoServerInfo.master_host });
  let encoded: string
  let replicationRecievedBytes = 0
  let replicationMaxBytes: number;
  let buffer: Buffer
  replica.on('connect', () => {
    buffer = Buffer.alloc(0)
    currentState = "HANDSHAKE_PING"
    replica.write(encodeCommand(["PING"]))
  })
  replica.on('data', async (data) => {
    if (currentState === "WRITE") {
      buffer = Buffer.concat([buffer, data]);
      const parsingResult = await processBuffer(buffer)
      buffer = parsingResult.remainingBuffer
      store.print()
    } else if (currentState === "HANDSHAKE_PING" && data.includes("PONG")) {
      currentState = "HANDSHAKE_REPLCONF1"
      encoded = encodeCommand(["REPLCONF", "listening-port", memoServerInfo.port.toString()])
    } else if (currentState === "HANDSHAKE_REPLCONF1" && data.includes("OK")) {
      currentState = "HANDSHAKE_REPLCONF2"
      encoded = encodeCommand(["REPLCONF", "capa", "eof", "capa", "psync2"])
    } else if (currentState === "HANDSHAKE_REPLCONF2" && data.includes("OK")) {
      currentState = "HANDSHAKE_PSYNC"
      encoded = encodeCommand(["PSYNC", "?", memoServerInfo.master_repl_id])
    } else if (currentState === "HANDSHAKE_PSYNC" && data.includes("FULLRESYNC")) {
      currentState = "HANDSHAKE_COMPLETE"
      //rec file
    } else if (currentState === "HANDSHAKE_COMPLETE") {
      // $numberofbytes \r\n bytes
      let slice = data
      if (String.fromCharCode(data[0]) === '$') {
        let offset = data.indexOf('\r\n')
        if (offset !== -1) {
          replicationMaxBytes = Number(data.slice(1, offset))
          slice = data.slice(offset + 2);
        }
      }
      fsPromises.appendFile('./dir/replication.txt', slice)
      if (slice.byteLength + replicationRecievedBytes === replicationMaxBytes) {
        const allCommands: string[][] = parseAOFFile('./dir/replication.txt')

        for (const command of allCommands) {
          await handleCommand(command, socketInfo)
        }
        currentState = "WRITE"
        store.print()
      } else {
        replicationRecievedBytes += slice.byteLength;
      }
    } else {
      currentState = "HANDSHAKE_PING"
      encoded = encodeCommand(["PING"])
    }
    if (currentState !== "WRITE" && currentState !== "HANDSHAKE_COMPLETE") {
      replica.write(encoded)
    }
  })
}
export async function processBuffer(buffer: Buffer): Promise<ParsingResult> {

  let currentBuffer: Buffer = buffer;
  const parsingResults: ParseResult[] = []
  while (true) {
    if (currentBuffer.length <= 0) {
      break;
    }

    const parsingResult = tryParse(currentBuffer);
    currentBuffer = parsingResult.remainingBuffer;
    parsingResults.push(parsingResult)
    if (parsingResult.error) {
      currentBuffer = Buffer.alloc(0)
      break;
    }
    if (!parsingResult.parsedCommand) {
      break;
    }
  }
  return { parsingResults, remainingBuffer: currentBuffer };
}

export async function masterHandle(formatedResponse: string, commandFullText: string, parsedCommand: string[], memoServerInfo: MemoServerInfo, socket: Socket) {


  if (commandFullText && parsedCommand && isWriteCommand(parsedCommand[0])) {
    if (commandFullText) {
      fsPromises.appendFile('./dir/aof.txt', commandFullText)
      for (const replicaSocket of memoServerInfo.replicas) {
        replicaSocket.write(commandFullText)
      }
    }
  }

  if (formatedResponse.includes('FULLRESYNC')) {
    const content = await fsPromises.readFile('./dir/aof.txt')
    memoServerInfo.replicas.add(socket)
    console.log('Sending AOF file content to replica')
    socket.write(`$${content.length}\r\n${content}`)
  }
}
