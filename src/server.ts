
import net from 'net'
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
