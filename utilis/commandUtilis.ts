console.log("commandUtilis loaded ✅");
export interface tryParseResult {
  remainingBuffer: Buffer,
  parsedCommand?: string[],
  error?: string
}

export function tryParse(buffer: Buffer): tryParseResult {
  let bufferPointer = 0
  let result: string[] = []
  if (String.fromCharCode(buffer[0]) !== '*') {
    return { remainingBuffer: buffer, error: `undefined command exptected * found ${buffer[0].toString()}` }
  }
  let delOffset = buffer.indexOf('\r\n', bufferPointer)
  if (delOffset === -1) {
    return { remainingBuffer: buffer }
  }
  let argCount = Number(buffer.slice(bufferPointer + 1, delOffset)) * 2// plus one for the * char
  bufferPointer = delOffset + 2//plus 2 for the \r\n character
  let argLength = 0;
  let i = 0
  for (; i < argCount; i++) {
    delOffset = buffer.indexOf('\r\n', bufferPointer)
    if (i % 2 === 0) {
      if (delOffset === -1) {
        return { remainingBuffer: buffer }
      }
      if (String.fromCharCode(buffer[bufferPointer]) !== '$') {
        return { remainingBuffer: buffer, error: `undefined command exptected $ found ${buffer[0].toString()}` }
      }
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
          return { remainingBuffer: buffer, error: "missing CRLF after bulk string" }
        }
      } else {
        break;
      }
    }

  }
  if (i < argCount) {
    return { remainingBuffer: buffer }
  }
  return { remainingBuffer: buffer.slice(bufferPointer), parsedCommand: result }
}


