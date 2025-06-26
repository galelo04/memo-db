
import net from 'net'


function handleSET(command: string[]): string {
  map.set(command[1], command[2])
  return "+OK\r\n"
}

function formatCommand(command: string): string[] {

  let formatedCommand = command.split('\r\n');
  let num = Number(formatedCommand[0].slice(1))
  let result = []
  let index = 2;
  for (let i = 0; i < num; i++) {
    result.push(formatedCommand[index])
    index += 2;
  }
  return result;

}
let map = new Map<string, any>();

const server = net.createServer((socket) => {
  console.log('client connected');
  socket.on('data', (data) => {
    console.log(formatCommand(data.toString()))
  });
});
server.listen(8080, () => {
  console.log('server listening on port 8080');
});
