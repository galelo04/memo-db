export interface KeyValueStore {

  insertEntry(key: string, value: any, expireDate?: Date): void
  getValue(key: string): any | undefined
  deleteEntry(key: string): number
  hasEntry(key: string): boolean
  expireEntry(key: string, expireDate: Date): number
  print(): void
  setConfig(key: string, value: string): void
  getConfig(key: string): string | undefined

}
