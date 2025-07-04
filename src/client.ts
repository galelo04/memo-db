import readline from 'readline/promises'
import net from 'net'
import { encodeCommand } from '../utilis/commandEncoding.ts';


const client = net.createConnection({ port: 8080 });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})
async function askAndSend() {
  const answer = await rl.question("> ")
  const splited = answer.split(/\s+/).filter(Boolean);
  let encoded = encodeCommand(splited)
  client.write(encoded)
}

client.on('connect', () => {
  askAndSend()
})
client.on('data', (data) => {
  console.log(data.toString())
  askAndSend()
})
