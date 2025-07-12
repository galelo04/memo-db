export type EntryType = 'string' | 'number' | 'set';
export type EntryTypeToValue = {
  string: string;
  number: number;
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
  getValue(key: string): any | undefined
  deleteEntry(key: string): number
  hasEntry(key: string): boolean
  expireEntry(key: string, expireDate: Date): number
  print(): void
  setConfig(key: string, value: string): void
  getConfig(key: string): string | undefined

}
