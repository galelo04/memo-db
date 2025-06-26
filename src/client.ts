import net from "net"
const client = net.connect({ port: 8080 });
client.on('data', (data) => {
  console.log(data.toString());
});
