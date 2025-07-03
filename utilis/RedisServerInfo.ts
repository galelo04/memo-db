type Role = "master" | "replica"
export class RedisServerInfo {
  readonly role: Role
  readonly port: number
  constructor(role: Role, port: number) {
    this.role = role;
    this.port = port
  }
}

export class RedisServerInfoBuilder {
  private _role: Role
  private _port: number
  setRole(role: Role) {
    this._role = role
    return this
  }
  setPort(port: number) {
    this._port = port
  }
  build() {
    return new RedisServerInfo(
      this._role,
      this._port
    )
  }
}
