import { tryParse } from '../utilis/commandUtilis.ts'
import type { tryParseResult } from '../utilis/commandUtilis.ts'
import net from 'net'
let buffer = Buffer.alloc(0)
let map = new Map<string, any>();
function isValidCommand(command: string): boolean {
  return (command === "SET" || command === "GET" || command === "DEL")
}
function handleSET(command: string[]): string {
  map.set(command[1], command[2])
  return "+OK\r\n"
}
function handleGET(command: string[]): string {
  if (map.has(command[1])) {
    return `$${map.get(command[1]).length}\r\n${map.get(command[1])}\r\n`
  }
  else {
    return "_\r\n"
  }
}

function handleDEL(command: string[]): string {

  let count = 0;
  for (let i = 1; i < command.length; i++) {

    if (map.has(command[i])) {
      map.delete(command[i])
      count++;
    }

  }
  return `:${count}\r\n`;
}

function handleCommand(command: string[]): Promise<string> {

  return new Promise((resolve, reject) => {

    if (isValidCommand(command[0])) {
      if (command[0] === "SET") {
        return resolve(handleSET(command))
      }
      else if (command[0] === "GET") {
        return resolve(handleGET(command))
      }
      else if (command[0] === "DEL") {
        return resolve(handleDEL(command))
      }
    }
    reject(`-ERR unknown command${command[0]}`)
  })
}
const server = net.createServer(async (socket) => {
  console.log('client connected');
  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data])
    let parseResult: tryParseResult = tryParse(buffer);
    while (buffer.length !== 0 && parseResult.parsedCommand !== null && parseResult.error === null) {
      buffer = Buffer.alloc(0)
      buffer = Buffer.concat([buffer, parseResult.remainingBuffer])
      handleCommand(parseResult.parsedCommand).then((result) => {

        console.log(`Map  after = ${[...map.entries()]}`)
        socket.write(result)
      }).catch((error) => {
        socket.write(`-${error}`)
      })
    }
    if (parseResult.error !== null) {
      socket.write(`-${parseResult.error}`)
    }
  })
})

server.listen(8080, () => {
  console.log('server listening on port 8080');
});
