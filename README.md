# Memo-DB

Memo-DB is an in-memory key-value database written in TypeScript that implements a subset of the Redis Serialization Protocol (RESP). It provides TCP socket connection handling, core Redis-compatible data structures, append-only persistence, transaction queuing, and master-replica command forwarding.

## Key Features

- Data Structure Support: Supports Strings (SET with EX/PX, GET, DEL, EXPIRE, INCR, DECR), Sets (SADD, SREM, SMEMBERS, SCARD, SINTER), and Hashes (HSET, HGET, HGETALL, HDEL).
- RESP Parsing and Formatting: Parses incoming RESP bulk string array commands over TCP and formats responses using RESP data types including Simple Strings, Bulk Strings, Integers, Arrays, Maps, Sets, Errors, and Nulls.
- Append-Only File (AOF) Persistence: Logs write operations to disk (`./dir/aof.txt`) and replays stored commands during server startup to restore state.
- Master-Replica Replication: Supports master and replica roles with initial full synchronization (PSYNC handshake and AOF buffer transfer) and real-time write command propagation to replica nodes.
- Basic Transaction Queuing: Supports sequential command queuing and execution using MULTI, EXEC, and DISCARD.
- Interactive CLI Client: Includes a lightweight command-line interface for communicating with a running server instance.

## Architecture and Tech Stack

### Tech Stack

- Language: TypeScript 5.8 (ESM target ES2020)
- Runtime: Node.js (v20+)
- Networking: Node.js `net` module (TCP socket server and client)
- CLI Parsing: Minimist
- ID Generation: Cuid
- Containerization: Docker (multi-stage build with `node:20` and `node:20-slim`)

### Component Overview

- `src/server.ts`: Entry point for server startup. Initializes configuration, loads AOF persistence data into memory, starts the TCP server, handles incoming socket connections, and manages replication streaming.
- `src/client.ts`: Interactive command-line client reading input from standard input and communicating with the server over TCP sockets.
- `models/MemoStore.ts`: In-memory data store containing key-value mappings (Strings, Sets, Hashes) with TTL expiration checking and configuration storage.
- `models/MemoServerInfo.ts`: Server state metadata including role (master/replica), port, replication IDs, offsets, and connected replica sockets.
- `utilis/commandParsing.ts`: RESP protocol frame parser for incoming TCP stream buffers and AOF replay processing.
- `utilis/commandHandlers.ts`: Command execution handlers for data operations, replication protocols, transaction queuing, and server configuration.
- `utilis/responseUtilis.ts`: RESP response formatter for socket writes.
- `utilis/serverUtilis.ts`: Handshake and sync procedures for replica nodes, buffer processing helpers, and write forwarding logic for master nodes.

## Getting Started and Installation

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- Docker (optional)

### Local Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/galelo04/memo-db.git
   cd memo-db
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the TypeScript source code:
   ```bash
   npm run build
   ```

### Running with Docker

Build the Docker image:
```bash
docker build -t memo-db .
```

Run a master instance on default port 6379:
```bash
docker run -p 6379:6379 memo-db
```

Run a replica instance pointing to a master node:
```bash
docker run -p 6380:6380 memo-db node ./dist/src/server.js --port 6380 --replicaof "host.docker.internal 6379"
```

## Usage and Examples

### Starting the Master Server

Start the server on default port 6379:
```bash
npm start
```

Start the server on a custom port:
```bash
node dist/src/server.js --port 6380
```

### Starting a Replica Server

Start a replica node connected to a master server running on localhost:6379:
```bash
node dist/src/server.js --port 6381 --replicaof "localhost 6379"
```

### Using the Interactive CLI Client

Connect the included interactive CLI client to a local instance:
```bash
node dist/src/client.js --port 6379
```

### Standalone TypeScript Client Library

For programmatic integration in Node.js or TypeScript applications, an official client library is maintained in a separate repository: [galelo04/memo-db-client](https://github.com/galelo04/memo-db-client).

```typescript
import { createClient } from 'memo-db-client';

const client = createClient({ host: 'localhost', port: 6379 });
await client.connect();

await client.set('user:1001', 'Alice');
const user = await client.get('user:1001');
console.log(user);
```

### Command Reference and Wire Examples

#### String Operations

- `SET key value [EX seconds] [PX milliseconds]`: Set key value with optional expiration time.
  ```text
  > SET user:1001 Alice EX 60
  +OK
  ```

- `GET key`: Retrieve value for key.
  ```text
  > GET user:1001
  $5
  Alice
  ```

- `INCR key`: Increment integer string value.
  ```text
  > INCR visits
  :1
  ```

- `DECR key`: Decrement integer string value.
  ```text
  > DECR visits
  :0
  ```

- `EXPIRE key seconds`: Set key expiration in seconds.
  ```text
  > EXPIRE user:1001 300
  :1
  ```

- `DEL key [key ...]`: Delete one or more keys.
  ```text
  > DEL user:1001 visits
  :2
  ```

#### Set Operations

- `SADD key member [member ...]`: Add members to set.
  ```text
  > SADD tags db typescript
  :2
  ```

- `SREM key member [member ...]`: Remove members from set.
  ```text
  > SREM tags db
  :1
  ```

- `SMEMBERS key`: Retrieve set members.
  ```text
  > SMEMBERS tags
  ~1
  $10
  typescript
  ```

- `SCARD key`: Get member count of set.
  ```text
  > SCARD tags
  :1
  ```

- `SINTER key [key ...]`: Intersect multiple sets.
  ```text
  > SINTER tags features
  ~0
  ```

#### Hash Operations

- `HSET key field value [field value ...]`: Set hash fields.
  ```text
  > HSET user:profile name Bob role engineer
  :2
  ```

- `HGET key field`: Retrieve hash field value.
  ```text
  > HGET user:profile name
  $3
  Bob
  ```

- `HGETALL key`: Retrieve all hash fields and values.
  ```text
  > HGETALL user:profile
  %2
  $4
  name
  $3
  Bob
  $4
  role
  $8
  engineer
  ```

- `HDEL key field [field ...]`: Delete fields from hash.
  ```text
  > HDEL user:profile role
  :1
  ```

#### Transactions

- `MULTI`: Start transaction queue.
- `EXEC`: Execute queued commands sequentially.
- `DISCARD`: Flush queued transaction commands.

Example transaction flow:
```text
> MULTI
+OK
> SET count 10
+QUEUED
> INCR count
+QUEUED
> EXEC
*2
+OK
:11
```

#### Server Operations

- `PING`: Verify server responsiveness. Returns `+PONG`.
- `INFO`: Return server metadata including role, port, replica count, or master replication offset.
- `CONFIG GET parameter`: Retrieve runtime configuration parameter (`dir`, `aof-fileName`).
- `CONFIG SET parameter value`: Set runtime configuration parameter.
