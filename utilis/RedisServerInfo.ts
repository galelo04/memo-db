import cuid from "cuid"
type Role = "master" | "replica"
export class RedisServerInfo {
  readonly role: Role
  readonly port: number
  readonly master_port: number
  readonly master_host: string
  readonly master_replid: string
  readonly master_repl_offset: number
  constructor(role: Role, port: number, master_port: number, master_host: string, master_replid: string, master_repl_offset: number) {
    this.role = role;
    this.port = port;
    this.master_port = master_port;
    this.master_host = master_host;
    this.master_replid = master_replid;
    this.master_repl_offset = master_repl_offset;
  }
  toBuilder(): RedisServerInfoBuilder {
    return new RedisServerInfoBuilder()
      .setRole(this.role)
      .setPort(this.port)
      .setMasterId(this.master_replid)
      .setMasterOffset(this.master_repl_offset)
      .setMasterDetails(this.master_port, this.master_host)
  }
}

export class RedisServerInfoBuilder {
  private _role: Role;
  private _port: number;
  private _master_port: number;
  private _master_host: string;
  private _master_replid: string;
  private _master_repl_offset: number;
  setRole(role: Role) {
    this._role = role
    return this
  }
  setPort(port: number) {
    this._port = port
    return this
  }
  setMasterDetails(masterPort: number, masterHost: string) {
    this._master_port = masterPort;
    this._master_host = masterHost;
    return this;
  }
  setMasterId(masterId: string) {
    this._master_replid = masterId;
    return this;
  }
  setMasterOffset(masterOffset: number) {
    this._master_repl_offset = masterOffset;
    return this;
  }
  build() {
    return new RedisServerInfo(
      this._role,
      this._port,
      this._master_port,
      this._master_host,
      this._master_replid,
      this._master_repl_offset
    )
  }
}
