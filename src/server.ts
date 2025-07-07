import { parseAOFFile } from '../utilis/commandParsing.ts'
import { RedisStore } from '../utilis/redisStore.ts'
import { createCommandHandlers } from '../utilis/commandHandlers.ts'
import net from 'net'
import { RedisServerInfo, RedisServerInfoBuilder } from '../utilis/RedisServerInfo.ts'
import type { SocketInfo } from '../utilis/RedisServerInfo.ts'
import minimist from 'minimist'
import cuid from 'cuid'
import { formatResponse, ResponseType } from '../utilis/responseUtilis.ts'
import type { Response } from '../utilis/responseUtilis.ts'
import { processBuffer, connectToMaster, masterHandle } from '../utilis/serverUtilis.ts'


async function main() {

  const argv = minimist(process.argv.slice(2))
  let redisServerInfo: RedisServerInfo;
  if (argv.replicaof) {
    const masterDetail = argv.replicaof.split(' ')
    redisServerInfo = new RedisServerInfoBuilder().setPort(+(argv.port) | 6379).setRole("replica").setMasterDetails(masterDetail[0], masterDetail[1]).setMasterId("-1").build()
  } else {
    redisServerInfo = new RedisServerInfoBuilder().setPort(+(argv.port) | 6379).setRole("master").setMasterId(cuid()).setMasterOffset(0).build()
  }

  const store = new RedisStore()
  const { handleCommand } = createCommandHandlers(store, redisServerInfo)
  const socketInfo: SocketInfo = { isTransaction: false, requesterType: 'client', commandsQueue: [] }
  if (redisServerInfo.role === "replica") {
    socketInfo.requesterType = 'master'
    connectToMaster(redisServerInfo, store, handleCommand, socketInfo)
  } else {
    //reading persistance file and apply commands to the store
    const allCommands: string[][] = parseAOFFile('./dir/aof.txt')
    for (const command of allCommands) {
      await handleCommand(command, socketInfo)
    }
  }

  const server = net.createServer((socket) => {
    const socketInfo: SocketInfo = { isTransaction: false, requesterType: 'client', commandsQueue: [] }
    let buffer = Buffer.alloc(0)
    console.log('client connected');
    socket.on('data', async (data) => {

      buffer = Buffer.concat([buffer, data])
      const processBufferResult = await processBuffer(buffer)
      buffer = processBufferResult.remainingBuffer;

      for (const parsingResult of processBufferResult.parsingResults) {
        let response: Response;
        if (parsingResult.error) {
          response = { type: ResponseType.error, data: [`${parsingResult.error}`] };
        }
        if (!parsingResult.parsedCommand || !parsingResult.fullCommandText) {
          break;
        }
        response = await handleCommand(parsingResult.parsedCommand, socketInfo)
        const formatedResponse = formatResponse(response)

        socket.write(formatedResponse)
        if (redisServerInfo.role === "master") {
          masterHandle(formatedResponse, parsingResult.fullCommandText, parsingResult.parsedCommand, redisServerInfo, socket)
        }
      }
    })
  })

  server.listen(redisServerInfo.port, () => {
    console.log(`server listening on port ${redisServerInfo.port}`);
  });
}

main()
