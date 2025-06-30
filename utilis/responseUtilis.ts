export const ResponseType = {
  simpleString: "+",
  bulkString: "$",
  integer: ":",
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

  let formatedResponse: string = response.type;
  if (response.type === ResponseType.array || response.type === ResponseType.map) {
    formatedResponse += response.data.length.toString() + "\r\n"
    for (const item of response.data) {
      if (isResponse((item)))
        formatedResponse += formatResponse(item)
    }
  }
  else {
    for (const arg of response.data) {
      formatedResponse += `${arg}\r\n`
    }
  }
  return formatedResponse
}
