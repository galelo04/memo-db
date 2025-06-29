export const ResponseType = {
  simpleString: "+",
  bulkString: "$",
  integer: ":",
  error: "-ERR ",
  null: "_"
} as const;

export type ResponseType = typeof ResponseType[keyof typeof ResponseType];

export interface Response {
  type: ResponseType;
  data: string[];
}export function formatResponse(response: Response): string {
  let formatedResponse: string = response.type;
  for (const arg of response.data) {
    formatedResponse += `${arg}\r\n`
  }
  return formatedResponse
}
