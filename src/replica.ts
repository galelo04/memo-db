import { tryParse, parseAOFFile } from '../utilis/commandParsing.ts'
import type { tryParseResult } from '../utilis/commandParsing.ts'
import { RedisStore } from '../utilis/redisStore.ts'
import { formatResponse, ResponseType } from '../utilis/responseUtilis.ts'
import { createCommandHandlers } from '../utilis/commandHandlers.ts'
import type { Response } from '../utilis/responseUtilis.ts'
import net, { Socket } from 'net'
import { RedisServerInfo, RedisServerInfoBuilder } from '../utilis/RedisServerInfo.ts'
import minimist from 'minimist'
import { encodeCommand } from '../utilis/commandEncoding.ts'
import fs from 'node:fs'
import { isWriteCommand } from '../utilis/commandHandlers.ts'


type MasterReplicaState = "HANDSHAKE_PING" | "HANDSHAKE_REPLCONF1" | "HANDSHAKE_REPLCONF2" | "HANDSHAKE_PSYNC" | "HANDSHAKE_COMPLETE" | "WRITE";

async function main() {
  async function processMasterBuffer() {
    while (true) {
      if (buffer.length <= 0) {
        break;
      }
      const result: tryParseResult = tryParse(buffer);
      if (result.error) {
        break;
      }
      if (!result.parsedCommand) {
        break;
      }
      buffer = result.remainingBuffer;
      try {
        await handleCommand(result.parsedCommand);
      } catch (err: any) {
        console.log(err)
      }
    }
  }
  const argv = minimist(process.argv.slice(2))
  const masterDetail = argv.replicaof.split(' ')
  let redisServerInfo = new RedisServerInfoBuilder().setPort(+(argv.port) | 8080).setRole("replica").setMasterDetails(masterDetail[0], masterDetail[1]).setMasterId("-1").build()
  let currentState: MasterReplicaState;
  const store = new RedisStore()
  const { handleCommand } = createCommandHandlers(store, redisServerInfo)
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
      processMasterBuffer()
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
      // fsPromises.appendFile('./dir/replication.txt', slice)
      fs.appendFileSync('./dir/replication.txt', slice)

      if (slice.byteLength + replicationRecievedBytes === replicationMaxBytes) {
        const allCommands: string[][] = parseAOFFile('./dir/replication.txt')
        for (const command of allCommands) {
          await handleCommand(command)
        }
        currentState = "WRITE"
        store.print()
      } else {
        replicationRecievedBytes = slice.byteLength;
      }
    } else {
      currentState = "HANDSHAKE_PING"
      encoded = encodeCommand(["PING"])
    }
    if (currentState !== "WRITE" && currentState !== "HANDSHAKE_COMPLETE") {
      console.log("encoded: ", encoded)
      replica.write(encoded)
    }
  })

  const server = net.createServer((socket) => {
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
        buffer = result.remainingBuffer;
        if (isWriteCommand(result.parsedCommand[0])) {
          response = { type: ResponseType.error, data: ["READONLY"] };
          socket.write(formatResponse(response))
          break;
        }
        try {
          response = await handleCommand(result.parsedCommand);
        } catch (err: any) {
          response = { type: ResponseType.error, data: [`${err.message || err}`] }
        }
        const formated = formatResponse(response)
        socket.write(formated)
      }
    }
    let buffer = Buffer.alloc(0)
    console.log('client connected');
    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data])
      processBuffer()
    })
  })

  server.listen(redisServerInfo.port, () => {
    console.log(`server listening on port ${redisServerInfo.port}`);
  });
}
main()
