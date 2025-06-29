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
export interface TypedData {
  type: ResponseType,
  value: string
}
export interface Response {
  type: ResponseType;
  data: TypedData[];
}
export function formatResponse(response: Response): string {

  let formatedResponse: string = response.type;
  if (response.type === ResponseType.array || response.type === ResponseType.map) {
    formatedResponse += response.data.length.toString() + "\r\n"
    for (const item of response.data) {
      formatedResponse += item.type + "\r\n" + item.value + "\r\n"
    }

  }
  else {

    for (const arg of response.data) {
      formatedResponse += `${arg}\r\n`
    }
  }
  return formatedResponse
}
