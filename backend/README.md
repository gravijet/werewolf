# Werewolf backend

Express and Socket.IO server for a single active game room. Manages players, roles, votes and game phases.

Requires Node.js 18 or newer.

```sh
npm install
npm start
npm test
```

Configure passwords, allowed origins and optional persistence locally. `GET /health` reports server status. Persisted rooms contain reconnect tokens and must remain outside Git.
