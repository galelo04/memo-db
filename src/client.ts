import readline from 'readline/promises'
import net from 'net'


const client = net.createConnection({ port: 3000 });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})
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
async function askAndSend() {

  const answer = await rl.question("> ")
  client.write(encodeCommand(answer))
}

client.on('connect', () => {
  askAndSend()
})
client.on('data', (data) => {
  console.log(data.toString())
  askAndSend()
})
