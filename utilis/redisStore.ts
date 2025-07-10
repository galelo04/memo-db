import type { KeyValueStore } from './storeInterface.js'
export interface storeEntry {
  value: any,
  expireDate?: Date
}
export class RedisStore implements KeyValueStore {
  map: Map<string, storeEntry>
  configMap: Map<string, string>
  constructor() {
    this.map = new Map<string, storeEntry>();
    this.configMap = new Map<string, string>();
    this.configMap.set("dir", "./dir")
    this.configMap.set("aof-fileName", "aof.txt")
  }
  insertEntry(key: string, value: any, expireDate?: Date): void {
    this.map.set(key, { value, expireDate })
  }
  getValue(key: string): any | undefined {
    if (this.map.has(key)) {
      const entryExpireDate = this.map.get(key)?.expireDate;
      if (!entryExpireDate || (entryExpireDate && entryExpireDate > new Date()))
        return this.map.get(key)?.value
      if (entryExpireDate && entryExpireDate < new Date())
        this.map.delete(key)
    }
    return undefined
  }
  deleteEntry(key: string): number {
    if (this.map.has(key)) {
      this.map.delete(key);
      return 1;
    }
    return 0;
  }
  hasEntry(key: string): boolean {
    return this.map.has(key)
  }
  expireEntry(key: string, expireDate: Date): number {
    if (this.map.has(key)) {
      const entry = this.map.get(key)
      this.map.set(key, { value: entry?.value, expireDate })

      return 1;
    }
    return 0;
  }
  print(): void {
    for (let [key, value] of this.map) {
      console.log(`key: ${key}  value: ${value.value} expireDate: ${value.expireDate ? value.expireDate : "N/A"}`)
    }
  }
  setConfig(key: string, value: string) {
    this.configMap.set(key, value)
  }
  getConfig(key: string) {
    if (this.configMap.has(key))
      return this.configMap.get(key)
  }
}
