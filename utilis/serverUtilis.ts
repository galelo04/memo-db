import { tryParse, parseAOFFile } from '../utilis/commandParsing.ts'
import type { tryParseResult } from '../utilis/commandParsing.ts'
import { RedisStore } from '../utilis/redisStore.ts'
import { formatResponse, ResponseType } from '../utilis/responseUtilis.ts'
import type { Response } from '../utilis/responseUtilis.ts'
import net, { Socket } from 'net'
import { RedisServerInfo, RedisServerInfoBuilder, SocketInfo } from '../utilis/RedisServerInfo.ts'
import { encodeCommand } from '../utilis/commandEncoding.ts'
import { appendFileSync, promises as fsPromises } from 'fs'
import { isWriteCommand } from './commandHandlers.ts'
interface ParsingResult {
  remainingBuffer: Buffer,
  parsingResults: tryParseResult[]
}
type MasterReplicaState = "HANDSHAKE_PING" | "HANDSHAKE_REPLCONF1" | "HANDSHAKE_REPLCONF2" | "HANDSHAKE_PSYNC" | "HANDSHAKE_COMPLETE" | "WRITE";
export async function connectToMaster(redisServerInfo: RedisServerInfo, store: RedisStore, handleCommand: (command: string[], socketInfo: SocketInfo) => Promise<Response>, socketInfo: SocketInfo) {
  let currentState: MasterReplicaState;
  const replica = net.createConnection({ port: redisServerInfo.master_port, host: redisServerInfo.master_host });
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
      encoded = encodeCommand(["REPLCONF", "listening-port", redisServerInfo.port.toString()])
    } else if (currentState === "HANDSHAKE_REPLCONF1" && data.includes("OK")) {
      currentState = "HANDSHAKE_REPLCONF2"
      encoded = encodeCommand(["REPLCONF", "capa", "eof", "capa", "psync2"])
    } else if (currentState === "HANDSHAKE_REPLCONF2" && data.includes("OK")) {
      currentState = "HANDSHAKE_PSYNC"
      encoded = encodeCommand(["PSYNC", "?", redisServerInfo.master_replid])
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
      // appendFileSync('./dir/replication.txt', slice)
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
  const parsingResults: tryParseResult[] = []
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

export async function masterHandle(formatedResponse: string, commandFullText: string, parsedCommand: string[], redisServerInfo: RedisServerInfo, socket: Socket) {


  if (commandFullText && parsedCommand && isWriteCommand(parsedCommand[0])) {
    if (commandFullText) {
      fsPromises.appendFile('./dir/aof.txt', commandFullText)
      for (const replicaSocket of redisServerInfo.replicas) {
        replicaSocket.write(commandFullText)
      }
    }
  }

  if (formatedResponse.includes('FULLRESYNC')) {
    const content = await fsPromises.readFile('./dir/aof.txt')
    redisServerInfo.replicas.add(socket)
    console.log('Sending AOF file content to replica')
    socket.write(`$${content.length}\r\n${content}`)
  }
}
