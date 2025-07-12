import { StoreEntry } from "./MemoStore.js";

export type EntryType = 'string' | 'set' | 'hash';
export type EntryTypeToValue = {
  string: string;
  set: Set<string>;
  hash: Map<string, string>;
};
export interface KeyValueStore {

  insertEntry<K extends EntryType>(
    key: string,
    value: EntryTypeToValue[K],
    type: K,
    expireDate?: Date
  ): void
  updateEntry<K extends EntryType>(
    key: string,
    newValue: EntryTypeToValue[K],
    type: K,
    newExpireDate?: Date
  ): boolean
  getEntry(key: string): StoreEntry | undefined
  deleteEntry(key: string): number
  hasEntry(key: string): boolean
  expireEntry(key: string, expireDate: Date): number
  print(): void
  setConfig(key: string, value: string): void
  getConfig(key: string): string | undefined
}
