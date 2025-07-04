import { tryParse, parseAOFFile } from '../utilis/commandParsing.ts'
import type { tryParseResult } from '../utilis/commandParsing.ts'
import { RedisStore } from '../utilis/redisStore.ts'
import { formatResponse, ResponseType } from '../utilis/responseUtilis.ts'
import { createCommandHandlers } from '../utilis/commandHandlers.ts'
import type { Response } from '../utilis/responseUtilis.ts'
import net, { Socket } from 'net'
import { RedisServerInfo, RedisServerInfoBuilder } from '../utilis/RedisServerInfo.ts'
import { encodeCommand } from '../utilis/commandEncoding.ts'
import { promises as fsPromises } from 'fs'
import { join } from 'path'
import minimist from 'minimist'
import cuid from 'cuid'

async function processBuffer(buffer: Buffer, handleCommand: (command: string[]) => Promise<Response>, socket: Socket, AOFdir?: string, AOFFileName?: string) {
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
      if (AOFFileName && AOFdir) {
        fsPromises.appendFile(join(AOFdir, AOFFileName), result.fullCommandText)
      }
    }
    buffer = result.remainingBuffer;
    try {
      response = await handleCommand(result.parsedCommand);
    } catch (err: any) {
      response = { type: ResponseType.error, data: [`${err.message || err}`] }
    }
    const formated = formatResponse(response)
    socket.write(formated)
    if (AOFdir && AOFFileName && formated.includes('FULLRESYNC')) {
      const content = await fsPromises.readFile(join(AOFdir, AOFFileName))
      socket.write(`$${content.length}\r\n${content}`)
    }
  }
}
function runReplica(redisServerInfo: RedisServerInfo, argv: minimist.ParsedArgs) {
  const masterDetail = argv.replicaof.split(' ')
  redisServerInfo = redisServerInfo.toBuilder().setRole("replica").setMasterDetails(masterDetail[0], masterDetail[1]).setMasterId("-1").build()
  const replica = net.createConnection({ port: redisServerInfo.master_port, host: redisServerInfo.master_host });
  replica.on('connect', () => {
    const commands = [["PING"], ["REPLCONF", "listening-port", argv.port], ["REPLCONF", "capa", "eof", "capa", "psync2"], ["PSYNC", "?", redisServerInfo.master_replid],];
    for (const command of commands) {
      const encoded = encodeCommand(command);
      replica.write(encoded)
    }
  })
  replica.on('data', (data) => {
    console.log(data);
  })
}

async function main() {
  const argv = minimist(process.argv.slice(2))
  let redisServerInfo = new RedisServerInfoBuilder().setPort(+(argv.port) | 8080).setRole("master").setMasterId(cuid()).setMasterOffset(0).build()
  if (argv.replicaof) {
    runReplica(redisServerInfo, argv)
  }
  const store = new RedisStore()
  const { handleCommand } = createCommandHandlers(store, redisServerInfo)
  let AOFFileName: string | undefined;
  let AOFdir: string | undefined;
  if (argv.aof) {
    AOFFileName = store.getConfig('aof-fileName');
    AOFdir = store.getConfig('dir')
    if (AOFFileName && AOFdir) {
      const allCommands: string[][] = parseAOFFile(join(AOFdir, AOFFileName))
      for (const command of allCommands) {
        await handleCommand(command)
      }
    }
  }

  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0)
    console.log('client connected');
    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data])
      processBuffer(buffer, handleCommand, socket, AOFdir, AOFFileName)
    })
  })

  server.listen(redisServerInfo.port, () => {
    console.log(`server listening on port ${redisServerInfo.port}`);
  });
}

main()
