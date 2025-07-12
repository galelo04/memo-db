import { Socket } from "net"

type Role = "master" | "replica"

type RequesterType = "client" | "master"
export interface SocketInfo {
  isTransaction: boolean,
  requesterType: RequesterType,
  commandsQueue: string[][]
}
export class MemoServerInfo {
  readonly role: Role
  readonly port: number
  readonly master_port: number
  readonly master_host: string
  readonly master_repl_id: string
  readonly master_repl_offset: number
  readonly replicas: Set<Socket>
  constructor(role: Role, port: number, master_port: number, master_host: string, master_repl_id: string, master_repl_offset: number) {
    this.role = role;
    this.port = port;
    this.master_port = master_port;
    this.master_host = master_host;
    this.master_repl_id = master_repl_id;
    this.master_repl_offset = master_repl_offset
    this.replicas = new Set<Socket>()
  }
  toBuilder(): MemoServerInfoBuilder {
    return new MemoServerInfoBuilder()
      .setRole(this.role)
      .setPort(this.port)
      .setMasterReplicationId(this.master_repl_id)
      .setMasterReplicationOffset(this.master_repl_offset)
      .setMasterDetails(this.master_port, this.master_host)
  }
}

export class MemoServerInfoBuilder {
  private _role!: Role;
  private _port!: number;
  private _master_port!: number;
  private _master_host!: string;
  private _master_repl_id!: string;
  private _master_repl_offset!: number;
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
  setMasterReplicationOffset(masterReplicatoinOffset: number) {
    this._master_repl_offset = masterReplicatoinOffset;
    return this;
  }
  setMasterReplicationId(masterReplicationId: string) {
    this._master_repl_id = masterReplicationId;
    return this;
  }
  build() {
    return new MemoServerInfo(
      this._role,
      this._port,
      this._master_port,
      this._master_host,
      this._master_repl_id,
      this._master_repl_offset
    )
  }
}
