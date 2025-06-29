export interface storeEntry {
  value: any,
  expireDate?: Date
}
export class RedisStore {
  map: Map<string, storeEntry>
  constructor() {
    this.map = new Map<string, storeEntry>();
  }
  insertEntry(key: string, value: any, expireDate?: Date): void {
    this.map.set(key, { value, expireDate })
  }
  getValue(key: string): any | undefined {
    if (this.map.has(key)) {
      const entryExpireDate = this.map.get(key)?.expireDate;
      if (!entryExpireDate || (entryExpireDate && entryExpireDate < new Date()))
        return this.map.get(key)?.value
      if (entryExpireDate && entryExpireDate > new Date())
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
}
