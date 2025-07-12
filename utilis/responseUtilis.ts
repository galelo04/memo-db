export const ResponseType = {
  simpleString: "+",
  bulkString: "$",
  integer: ":",
  set: "~",
  map: "%",
  array: "*",
  error: "-ERR ",
  null: "_"
} as const;

export type ResponseType = typeof ResponseType[keyof typeof ResponseType];
export interface Response {
  type: ResponseType;
  data: Response[] | string[];
}
function isResponse(obj: any): obj is Response {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    typeof obj.type === 'string' && // ResponseType is a string literal union
    'data' in obj &&
    Array.isArray(obj.data) &&
    (
      obj.data.length === 0 || // handle empty array safely
      typeof obj.data[0] === 'string' ||
      (typeof obj.data[0] === 'object' && obj.data[0] !== null && 'type' in obj.data[0])
    )
  );
}
export function formatResponse(response: Response): string {
  const CRLF = '\r\n';
  let formatted = response.type;

  if (response.type === ResponseType.set || response.type === ResponseType.array || response.type === ResponseType.map) {
    formatted += response.data.length + CRLF;
    for (const item of response.data) {
      if (!isResponse(item)) {
        throw new Error("Invalid response item in set/array/map");
      }
      formatted += formatResponse(item);
    }
  } else if (response.type === ResponseType.bulkString && typeof response.data[0] === 'string') {
    formatted += response.data[0].length + CRLF + response.data[0] + CRLF;
  } else if (response.type === ResponseType.null) {
    return "_\r\n";
  } else {
    formatted += (response.data[0] ?? "") + CRLF;
  }

  return formatted;
}

