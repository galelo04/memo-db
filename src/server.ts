
import net from 'net'

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

async function formatCommand(command: string): Promise<string[]> {
  return new Promise((resolve) => {
    process.nextTick(() => {

      let formatedCommand = command.split('\r\n');
      let num = Number(formatedCommand[0].slice(1))
      let result = []
      let index = 2;
      for (let i = 0; i < num; i++) {
        result.push(formatedCommand[index])
        index += 2;
      }
      resolve(result)
    })
  })
}
async function handleCommand(command: string): Promise<string> {

  return formatCommand(command).then(formatedCommand => {

    if (isValidCommand(formatedCommand[0])) {
      if (formatedCommand[0] === "SET") {
        return handleSET(formatedCommand)
      }
      else if (formatedCommand[0] === "GET") {
        return handleGET(formatedCommand)
      }
      else if (formatedCommand[0] === "DEL") {
        return handleDEL(formatedCommand)
      }
    }
    return `-ERR unknown command${formatedCommand[0]}`
  });
}
const server = net.createServer((socket) => {
  console.log('client connected');
  socket.on('data', (data) => {
    handleCommand(data.toString()).then((result) => {

      console.log(`Map  after = ${[...map.entries()]}`)
      socket.write(result)
    })
  })
})
server.listen(8080, () => {
  console.log('server listening on port 8080');
});
