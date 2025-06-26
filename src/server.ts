
import net from 'net'



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



const server = net.createServer((socket) => { //'connection' listener
  console.log('client connected');
  socket.on('end', () => {
    console.log('client disconnected');
  });
  socket.write('hello\r\n');
});
server.listen(8080, function() { //'listening' listener
  console.log('server bound');
});
