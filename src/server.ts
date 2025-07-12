import { parseAOFFile } from '../utilis/commandParsing.js'
import { MemoStore } from '../models/MemoStore.js'
import { createCommandHandlers } from '../utilis/commandHandlers.js'
import net from 'net'
import { MemoServerInfo, MemoServerInfoBuilder } from '../models/MemoServerInfo.js'
import type { SocketInfo } from '../models/MemoServerInfo.js'
import minimist from 'minimist'
import cuid from 'cuid'
import { formatResponse, ResponseType } from '../utilis/responseUtilis.js'
import type { Response } from '../utilis/responseUtilis.js'
import { processBuffer, connectToMaster, masterHandle } from '../utilis/serverUtilis.js'


async function main() {

  const argv = minimist(process.argv.slice(2))

  let memoServerInfo: MemoServerInfo;
  if (argv.replicaof) {
    const masterDetail = argv.replicaof.split(' ')
    memoServerInfo = new MemoServerInfoBuilder().setPort(+(argv.port) | 6379).setRole("replica").setMasterDetails(masterDetail[0], masterDetail[1]).setMasterReplicationId("-1").build()
  } else {
    memoServerInfo = new MemoServerInfoBuilder().setPort(+(argv.port) | 6379).setRole("master").setMasterReplicationId(cuid()).setMasterReplicationOffset(0).build()
  }

  const store = new MemoStore()
  const { handleCommand } = createCommandHandlers(store, memoServerInfo)
  const socketInfo: SocketInfo = { isTransaction: false, requesterType: 'client', commandsQueue: [] }

  if (memoServerInfo.role === "replica") {
    socketInfo.requesterType = 'master'
    connectToMaster(memoServerInfo, store, handleCommand, socketInfo)
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
        if (memoServerInfo.role === "master") {
          masterHandle(formatedResponse, parsingResult.fullCommandText, parsingResult.parsedCommand, memoServerInfo, socket)
        }
      }
    })
  })

  server.listen(memoServerInfo.port, () => {
    console.log(`server listening on port ${memoServerInfo.port}`);
  });
}

main()
