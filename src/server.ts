import { tryParse, parseAOFFile } from '../utilis/commandParsing.ts'
import type { tryParseResult } from '../utilis/commandParsing.ts'
import { RedisStore } from '../utilis/redisStore.ts'
import { formatResponse, ResponseType } from '../utilis/responseUtilis.ts'
import { createCommandHandlers } from '../utilis/commandHandlers.ts'
import type { Response } from '../utilis/responseUtilis.ts'
import net, { Socket } from 'net'
import { promises as fsPromises } from 'fs'
import { join } from 'path'
import minimist from 'minimist'

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
    socket.write(formatResponse(response))
  }
}

async function main() {
  const argv = minimist(process.argv.slice(2))
  const PORT = argv.port | 8080;
  console.log(argv)
  const store = new RedisStore()
  const { handleCommand } = createCommandHandlers(store)
  const AOFFileName = store.getConfig('aof-fileName');
  const AOFdir = store.getConfig('dir')
  if (AOFFileName && AOFdir) {
    const allCommands: string[][] = parseAOFFile(join(AOFdir, AOFFileName))
    for (const command of allCommands) {
      await handleCommand(command)
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

  server.listen(PORT, () => {
    console.log(`server listening on port ${PORT}`);
  });
}

main()
