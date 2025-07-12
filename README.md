# 🗄️ Memo-DB

**A blazing-fast, Redis-compatible mini database built from scratch in TypeScript**

> *Because sometimes you need Redis, but you want to understand every byte of it.*

Memo-DB is a lightweight, high-performance Redis clone that implements the Redis Serialization Protocol (RESP3) with full master-replica replication, transactions, and persistence. Perfect for learning, prototyping, or scenarios where you need a Redis-compatible database without the complexity.

## 🌟 Why Memo-DB?

- **🚀 Lightning Fast**: Built with performance in mind using Node.js and TypeScript
- **🔧 Redis Compatible**: Implements RESP3 protocol for seamless integration with existing Redis clients
- **🐳 Docker Ready**: One command deployment with Docker
- **📦 TypeScript Native**: Full type safety and excellent developer experience
- **🔄 Real Replication**: Master-replica setup with automatic synchronization
- **💾 Persistent**: AOF (Append-Only File) persistence keeps your data safe

## 📋 Features

### Core Database Operations
- **String Operations**: `SET`, `GET`, `DEL`, `EXPIRE`, `INCR`, `DECR`
- **Set Operations**: `SADD`, `SREM`, `SMEMBERS`, `SCARD`, `SINTER`
- **Hash Operations**: `HSET`, `HGET`, `HGETALL`, `HDEL`
- **Transactions**: `MULTI`, `EXEC`, `DISCARD` with full ACID compliance
- **Server Management**: `PING`, `INFO`, `CONFIG`

### Advanced Features
- **🔄 Master-Replica Replication**: Full synchronization with automatic failover
- **📝 AOF Persistence**: Append-Only File for crash recovery
- **🔐 RESP3 Protocol**: Latest Redis protocol implementation
- **⚡ Transactions**: Atomic operations with rollback support
- **🎛️ Runtime Configuration**: Dynamic configuration updates

## 🚀 Quick Start

### 🐳 Docker Deployment (Recommended)

```bash
# Pull and run the latest version
docker build -t memo-db .

# Or build locally
git clone https://github.com/galelo04/memo-db.git
cd memo-db
docker build -t memo-db .
docker run -p 6379:6379 memo-db
```

### 📦 Local Installation

```bash
# Clone and install
git clone https://github.com/galelo04/memo-db.git
cd memo-db
npm install

# Build and start
npm run build
npm start

# Custom configuration
npm start -- --port 6380
```

## 🎯 Client Library

**Meet [`memo-db-client`](https://github.com/galelo04/memo-db-client)** - The official TypeScript client library for seamless integration:

```bash
npm install memo-db-client
```

### 💻 Client Usage

```typescript
import { createClient } from 'memo-db-client';

// Create and connect 
const client = createClient(); //  defaults port:6379 host:localhost

await client.connect();

// String operations
await client.set('user:1001', 'john_doe');
const user = await client.get('user:1001');
console.log(`Welcome, ${user}!`);

// Atomic operations
await client.set('counter', '0');
const newCount = await client.incr('counter');
console.log(`Visitor #${newCount}`);

// Expiration
await client.set('session:abc123', 'user_data');
await client.expire('session:abc123', 3600); // 1 hour TTL

// Bulk operations
await client.del(['old_key1', 'old_key2', 'temp_data']);

// Server health
const serverInfo = await client.info();
console.log(serverInfo)

// Graceful shutdown
await client.quit();
```

### 🔄 Advanced Client Features

```typescript
// Connection with retry logic
const client = createClient({
  host: 'localhost',
  port: 6379,
});

// Event handling
client.on('connect', () => console.log('Connected to Memo-DB'));
client.on('error', (err) => console.error('Connection error:', err));
client.on('disconnect', () => console.log('Disconnected'));

// Health monitoring
const ping = await client.ping();
if (ping === 'PONG') {
  console.log('✅ Server is healthy');
}
```

## 🏗️ Architecture Deep Dive

### 🧠 Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   TCP Server    │    │  Command        │    │   Data Store    │
│   (RESP3)       │◄──►│  Handlers       │◄──►│   (Memory)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Replication   │    │  Transactions   │    │   Persistence   │
│   Master/Slave  │    │  (MULTI/EXEC)   │    │   (AOF)         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 🔄 RESP3 Protocol Implementation

Memo-DB implements the Redis Serialization Protocol version 3 (RESP3), providing:

- **Type Safety**: Strict typing for all Redis data types
- **Backwards Compatibility**: Full compatibility with RESP2 clients
- **Enhanced Features**: Better error handling and metadata support
- **Performance**: Optimized parsing and serialization

```typescript
// RESP3 Protocol Examples
"+OK\r\n"                    // Simple String
"-ERR unknown command\r\n"   // Error
":1000\r\n"                  // Integer
"$5\r\nhello\r\n"           // Bulk String
"*2\r\n$4\r\necho\r\n$5\r\nhello\r\n"  // Array
```

## 🎛️ Server Configuration

### 🚀 Master Server

```bash
# Start master on default port
node ./dist/src/server.js

# Custom port
node ./dist/src/server.js --port 6379

# With Docker
docker run -p 6379:6379 memo-db
```

### 🔄 Replica Server

```bash
# Start replica
node ./dist/src/server.js --port 6380 --replicaof "localhost 6379"

# Multiple replicas
node ./dist/src/server.js --port 6381 --replicaof "localhost 6379"
node ./dist/src/server.js --port 6382 --replicaof "localhost 6379"

# With Docker
docker run -p 6380:6380 memo-db node ./dist/src/server.js --port 6380 --replicaof "host.docker.internal 6379"
```

## 🛠️ Command Reference

### 📝 String Commands
```bash
SET key value [EX seconds] [PX milliseconds]
GET key
DEL key [key ...]
EXPIRE key seconds
INCR key
DECR key
```

### 🗂️ Set Commands
```bash
SADD key member [member ...]
SREM key member [member ...]
SMEMBERS key
SCARD key
SINTER key [key ...]
```

### 🏷️ Hash Commands
```bash
HSET key field value [field value ...]
HGET key field
HGETALL key
HDEL key field [field ...]
```

### 💼 Transaction Commands
```bash
MULTI
EXEC
DISCARD
```

### 🔧 Server Commands
```bash
PING [message]
INFO [section]
CONFIG GET parameter
CONFIG SET parameter value
```

## Architecture

### Core Components

- **MemoStore**: In-memory key-value store with support for multiple data types
- **CommandHandlers**: Redis command implementation and processing
- **ServerUtils**: Replication and master-replica communication
- **ResponseUtils**: Redis protocol response formatting
- **CommandParsing**: RESP protocol parsing

### Data Types Support

- **String**: Basic string values with optional expiration
- **Set**: Unordered collection of unique strings
- **Hash**: Key-value pairs (field-value mappings)

### Persistence

- **AOF (Append-Only File)**: All write commands are logged to `./dir/aof.txt`
- **Replication Log**: Replica synchronization data stored in `./dir/replication.txt`

## Configuration

### Command Line Arguments

- `--port`: Server port (default: 6379)
- `--replicaof`: Master server details for replica mode (format: "host port")

### Runtime Configuration

```
CONFIG SET dir "/custom/directory"
CONFIG SET aof-fileName "custom-aof.txt"
CONFIG GET dir
CONFIG GET aof-fileName
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork & Clone**: Fork the repo and clone locally
2. **Install**: Run `npm install` to install dependencies  
3. **Develop**: Make your changes with tests
4. **Submit**: Create a pull request with a clear description

### 🎯 Areas for Contribution
- [ ] Additional Redis commands (LISTS, STREAMS)
- [ ] Lua scripting support
- [ ] Clustering capabilities
- [ ] Performance optimizations
- [ ] Better monitoring tools

## 📚 Learning Resources

- **Networking**: TCP protocol and connection handling
- **Replication**: Master-slave architectures and consistency models
- **Persistence**: Write-ahead logs and crash recovery

## 🐛 Known Limitations 

- **Clustering**: No Redis Cluster support yet
- **Pub/Sub**: Publish/Subscribe not implemented
- **Lua**: No Lua scripting support
- **Modules**: No module system
- **Streams**: Redis Streams not supported

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Redis team for the amazing database design
- Node.js community for the excellent ecosystem
- TypeScript team for making JavaScript bearable 😉

---

**Ready to memo-ize your data?** 🚀

[⭐ Star us on GitHub](https://github.com/galelo04/memo-db) 
