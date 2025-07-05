import { parseAOFFile } from '../utilis/commandParsing.ts'
import { RedisStore } from '../utilis/redisStore.ts'
import { createCommandHandlers } from '../utilis/commandHandlers.ts'
import net from 'net'
import { RedisServerInfo, RedisServerInfoBuilder } from '../utilis/RedisServerInfo.ts'
import minimist from 'minimist'
import cuid from 'cuid'
import { processBuffer, connectToMaster, replicaHandle, masterHandle } from '../utilis/serverUtilis.ts'
async function main() {

  const argv = minimist(process.argv.slice(2))
  let redisServerInfo: RedisServerInfo;
  if (argv.replicaof) {
    const masterDetail = argv.replicaof.split(' ')
    redisServerInfo = new RedisServerInfoBuilder().setPort(+(argv.port) | 8080).setRole("replica").setMasterDetails(masterDetail[0], masterDetail[1]).setMasterId("-1").build()
  } else {
    redisServerInfo = new RedisServerInfoBuilder().setPort(+(argv.port) | 8080).setRole("master").setMasterId(cuid()).setMasterOffset(0).build()
  }

  const store = new RedisStore()
  const { handleCommand } = createCommandHandlers(store, redisServerInfo)

  if (redisServerInfo.role === "replica") {

    connectToMaster(redisServerInfo, store, handleCommand)
  } else {
    //reading persistance file and apply commands to the store
    const allCommands: string[][] = parseAOFFile('./dir/aof.txt')
    for (const command of allCommands) {
      await handleCommand(command)
    }
  }

  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0)
    console.log('client connected');
    socket.on('data', async (data) => {
      buffer = Buffer.concat([buffer, data])
      const result = await processBuffer(buffer, handleCommand)
      if (result) {
        if (redisServerInfo.role === "replica") {

          replicaHandle(result, socket)
        } else if (redisServerInfo.role === "master") {
          masterHandle(result, redisServerInfo, socket)
        }
        if (result.formatedResponse)
          socket.write(result.formatedResponse)
        if (result.parsingResult.remainingBuffer)
          buffer = result.parsingResult.remainingBuffer
      }
    })
  })

  server.listen(redisServerInfo.port, () => {
    console.log(`server listening on port ${redisServerInfo.port}`);
  });
}

main()
