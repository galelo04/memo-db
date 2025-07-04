export function encodeCommand(splitedCommand: string[]): string {
  let result = "";
  const CLRF = '\r\n'
  result = result.concat(`*${splitedCommand.length}`, CLRF)
  splitedCommand.forEach((word) => {
    result = result.concat(`$${word.length}`, CLRF, word, CLRF)
  })
  return result;
}

