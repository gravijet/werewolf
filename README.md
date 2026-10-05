# Werewolf

Realtime companion for in-person Werewolf games. The React frontend handles players and host controls; the Node.js backend manages roles and game phases through Socket.IO.

## Development

```sh
cd backend
npm install
npm start
```

In a separate terminal:

```sh
cd frontend
npm install
npm run dev
```

Run backend tests with `npm test` in `backend/` and build the frontend with `npm run build` in `frontend/`.

Set passwords, allowed origins and `VITE_API_URL` for your own instance. Saved sessions and reconnect tokens are excluded from Git.
