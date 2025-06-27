import { tryParse } from '../utilis/commandUtilis.ts'
import type { tryParseResult } from '../utilis/commandUtilis.ts'
import { Store } from '../utilis/store.ts'
import net from 'net'
let buffer = Buffer.alloc(0)
let store = new Store()
function isValidCommand(command: string): boolean {
  return (command === "SET" || command === "GET" || command === "DEL")
}
function handleSET(command: string[]): string {
  if (command.length === 3) {
    store.insertEntry(command[1], command[2])
  }
  else if (command.length === 5) {
    const now = new Date();
    const secondsToAdd = Number(command[4]);

    const expireDate = new Date(now.getTime() + secondsToAdd * 1000);
    store.insertEntry(command[1], command[2], expireDate)
  }
  return "+OK\r\n"
}
function handleGET(command: string[]): string {
  const entry = store.getValue(command[1])
  if (entry) {
    return `$${entry.length}\r\n${entry}\r\n`
  }
  else {
    return "_\r\n"
  }
}

function handleDEL(command: string[]): string {

  let count = 0;
  for (let i = 1; i < command.length; i++) {

    count += store.deleteEntry(command[i])
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
        store.print()
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
