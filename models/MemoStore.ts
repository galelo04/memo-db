import type { KeyValueStore } from './StoreInterface.js'
import { EntryType, EntryTypeToValue } from './StoreInterface.js'

export type StoreEntry =
  | { type: 'string'; value: string; expireDate?: Date }
  | { type: 'set'; value: Set<string>; expireDate?: Date }
  | { type: 'hash'; value: Map<string, string>; expireDate?: Date }

function createStoreEntry<K extends EntryType>(
  type: K,
  value: EntryTypeToValue[K],
  expireDate?: Date
): StoreEntry {
  return { type, value, expireDate } as StoreEntry;
}

export class MemoStore implements KeyValueStore {
  map: Map<string, StoreEntry>
  configMap: Map<string, string>

  constructor() {
    this.map = new Map<string, StoreEntry>();
    this.configMap = new Map<string, string>();
    this.configMap.set("dir", "./dir")
    this.configMap.set("aof-fileName", "aof.txt")
  }

  insertEntry<K extends EntryType>(
    key: string,
    value: EntryTypeToValue[K],
    type: K,
    expireDate?: Date
  ): void {
    this.map.set(key, createStoreEntry(type, value, expireDate));
  }

  updateEntry<K extends EntryType>(
    key: string,
    newValue: EntryTypeToValue[K],
    type: K,
    newExpireDate?: Date
  ): boolean {
    const existing = this.map.get(key);
    if (!existing || existing.type !== type) {
      return false;
    }

    const updatedEntry: StoreEntry = createStoreEntry(
      type,
      newValue,
      newExpireDate ?? existing.expireDate)

    this.map.set(key, updatedEntry);
    return true;
  }



  getEntry(key: string): StoreEntry | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    const { expireDate } = entry;

    if (expireDate && expireDate < new Date()) {
      this.map.delete(key);
    }

    return entry;
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
    const entry: StoreEntry | undefined = this.map.get(key)
    if (entry) {
      this.map.set(key, { expireDate, ...entry })

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
