import { tryParse, parseAOFFile } from '../utilis/commandParsing.ts'
import type { tryParseResult } from '../utilis/commandParsing.ts'
import { RedisStore } from '../utilis/redisStore.ts'
import { formatResponse, ResponseType } from '../utilis/responseUtilis.ts'
import { createCommandHandlers } from '../utilis/commandHandlers.ts'
import type { Response } from '../utilis/responseUtilis.ts'
import net from 'net'
import { promises as fsPromises } from 'fs'
import { join } from 'path'

let store = new RedisStore()
let { handleCommand } = createCommandHandlers(store)
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


try {
  const AOFFileName = store.getConfig('aof-fileName')
  const AOFdir = store.getConfig('dir')
  if (AOFFileName && AOFdir) {
    const allCommands: string[][] = parseAOFFile(join(AOFdir, AOFFileName))
    const promises = []
    for (const command of allCommands) {
      promises.push(handleCommand(command))

    }

    Promise.all(promises).then(() => {
      server.listen(8080, () => {

        console.log('server listening on port 8080');
      });
    }).catch((error) => {
      console.log(`Error ${error}`)

    });
  }
} catch (error) {
  console.error('Error reading file:', error)
}


