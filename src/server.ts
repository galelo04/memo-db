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

    if (isValidCommand(command[0].toUpperCase())) {
      switch (command[0].toUpperCase()) {
        case "SET":
          return resolve(handleSET(command))

        case "GET":
          return resolve(handleGET(command))

        case "DEL":
          return resolve(handleDEL(command))
      }
    }
    reject(`-ERR unknown command${command[0]}`)
  })
}
const server = net.createServer((socket) => {

  async function processBuffer() {
    while (true) {
      const result: tryParseResult = tryParse(buffer);
      if (result.error) {
        socket.write(`-${result.error}\r\n`);
        break;
      }
      if (result.parsedCommand === null) {
        break;
      }
      buffer = result.remainingBuffer;
      try {
        const response = await handleCommand(result.parsedCommand);
        console.log(`Map  after = ${[...map.entries()]}`)
        socket.write(response);
      } catch (err: any) {
        socket.write(`-ERR ${err.message || err}\r\n`);
      }
    }
  }
  console.log('client connected');
  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data])
    processBuffer()
  })
})

server.listen(8080, () => {
  console.log('server listening on port 8080');
});
