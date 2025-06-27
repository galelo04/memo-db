interface tryParseResult {
  remainingBuffer: Buffer,
  parsedCommand: string[] | null,
  error: string | null
}
function tryParse(buffer: Buffer): tryParseResult {
  let bufferPointer = 0
  let stringdd = buffer.toString()
  let result: string[] = []
  let test = String.fromCharCode(buffer[0])
  if (String.fromCharCode(buffer[0]) !== '*') {
    return { remainingBuffer: buffer, parsedCommand: null, error: "undefined command *****" }
  }
  let delOffset = buffer.indexOf('\r\n', bufferPointer)
  if (delOffset === -1) {
    return { remainingBuffer: buffer, parsedCommand: null, error: null }
  }
  let argCount = Number(buffer.slice(bufferPointer + 1, delOffset)) * 2// plus one for the * char
  bufferPointer = delOffset + 2//plus 2 for the \r\n character
  let argLength = 0;
  let i = 0
  for (; i < argCount; i++) {
    delOffset = buffer.indexOf('\r\n', bufferPointer)
    if (i % 2 === 0) {
      if (delOffset === -1) {
        return { remainingBuffer: buffer, parsedCommand: null, error: null }
      }
      // if (String.fromCharCode(buffer[bufferPointer]) !== '$') {
      //   return { remainingBuffer: buffer, parsedCommand: null, error: "undefined command $$$$$$$$" }
      // }
      argLength = Number(buffer.slice(bufferPointer + 1, delOffset))//plus one for the $ char
      bufferPointer = delOffset + 2
    } else {
      const slice = buffer.slice(bufferPointer, bufferPointer + argLength)
      if (argLength === slice.length) {
        result.push(slice.toString())
        bufferPointer += argLength;
        if (String.fromCharCode(buffer[bufferPointer]) === '\r' && String.fromCharCode(buffer[bufferPointer + 1]) === '\n') {
          bufferPointer += 2;
        } else {
          return { remainingBuffer: buffer, parsedCommand: null, error: "missing CRLF after bulk string" }
        }
      } else {
        break;
      }
    }

  }
  if (i < argCount) {
    return { remainingBuffer: buffer, parsedCommand: null, error: null }
  }
  return { remainingBuffer: buffer.slice(bufferPointer), parsedCommand: result, error: null }
}
tryParse(Buffer.from('*3\r\n$3\r\nSET\r\n$3\r\nval\r\n$3\r\nvar\r\n'))