# Game state and events

The backend owns game state. Clients send actions through Socket.IO and receive updated room state.

Roles, turn order and voting rules are implemented in `backend/src/game-state.js` and `backend/src/roles-engine.js`. A reconnect requires the saved player identifier and reconnect token.

Use the backend tests to check role distribution, phase changes, host assignment and round resets.
