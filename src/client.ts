import net from "net"

function encodeCommand(command: string): string {

  let result = "";
  const carridge = '\r\n'
  const splitedCommand = command.split(/\s+/).filter(Boolean);
  result = result.concat(`*${splitedCommand.length}`, carridge)
  splitedCommand.forEach((word) => {
    result = result.concat(`$${word.length}`, carridge, word, carridge)
  })
  return result;
}




const client = net.connect({ port: 8080 });
client.on('data', (data) => {
  console.log(data.toString());
});
