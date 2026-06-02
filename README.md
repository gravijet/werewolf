# Werwolf

Digitale Unterstützung für eine physische Werwolf-Spielrunde: ein gemeinsamer Spielraum mit Echtzeit-Sync (Socket.io), Mobile-First-UI und Host-Audio.

- **Backend:** Node.js (Express) + Socket.io, ein aktiver Raum, Spielzustand im Speicher, Rate-Limiting & Tests
- **Frontend:** React (Vite), farbenfrohes Material-You-Design mit Dark Mode & phasenabhängiger Farbwelt, i18n (DE/EN/SV), mehrsprachige Host-Sprachanweisungen

**Highlights:** dynamische Nacht-Phasen (überspringt automatisch Rollen, die nicht im Spiel sind) · Rollen-Auflösung mit Konfetti am Spielende · „Neue Runde" für den Host · Einladen per Link teilen · Diskussions-Timer · Dark Mode.

---

## Schnellstart (lokal)

**Voraussetzung:** Node.js 18+

### 1. Backend starten

```bash
cd backend
npm install
npm start
```

Backend läuft auf **http://localhost:3000**.

### 2. Frontend starten

In einem zweiten Terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend läuft auf **http://localhost:5173**. Im Browser öffnen; das Frontend verbindet sich per Proxy mit dem Backend.

### 3. Spielen

- **Spieler-Passwort:** `WOLFGAME`
- **Admin-Passwort:** `WOLFGAMEADMIN`

Mehrere Tabs/Geräte mit dem gleichen Frontend-URL nutzen; ein Host startet das Spiel aus der Lobby.

### Kurz prüfen, ob alles läuft

1. **Backend:** Im Ordner `backend` → `npm install` → `npm start`. Im Browser **http://localhost:3000/health** öffnen → es erscheint `{"ok":true,"service":"werwolf-service"}`.
2. **Frontend:** Im Ordner `frontend` → `npm install` → `npm run dev`. **http://localhost:5173** öffnen → Join-Maske mit Name/Passwort erscheint.
3. **Spielablauf:** Mit Passwort `WOLFGAME` beitreten → Lobby. In weiteren Tabs erneut beitreten → weitere Spieler sichtbar. Erster Tab ist Host → „Spiel starten“ (ab 3 Mitspielern möglich; der Host zählt als Spielleitung nicht mit).

Die **index.html** im Projektroot ist nur eine Hinweis-Seite („Start: cd frontend …“). Die eigentliche App ist das **Frontend** unter `frontend/` (Einstieg: `frontend/index.html` → lädt per Vite `src/main.jsx`).

---

## Projektstruktur

```
Werwolf/
├── backend/          # Express + Socket.io
│   ├── src/
│   │   ├── server.js
│   │   ├── game-state.js
│   │   ├── roles-engine.js
│   │   └── constants.js
│   └── .env.example
├── frontend/         # React (Vite)
│   ├── src/
│   │   ├── context/GameContext.jsx
│   │   ├── screens/  # Join, Lobby, Mayor, Night, Day, Result, Dead, Admin
│   │   ├── components/
│   │   ├── i18n/
│   │   └── audio/
│   └── .env.example
├── docs/
│   ├── game-state-and-events.md   # State-Modell & Socket-Events
│   └── DEPLOYMENT.md              # Deployment & Produktion
└── README.md
```

---

## Konfiguration

| Umgebung      | Backend                    | Frontend              |
|---------------|----------------------------|------------------------|
| **Lokal (Dev)** | `PORT=3000` (optional)     | nicht nötig (Proxy)   |
| **Produktion** | `PORT`, `PLAYER_PASSWORD`, `ADMIN_PASSWORD` | `VITE_API_URL` = Backend-URL |

Details: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Weitere Dokumentation

- [Backend README](backend/README.md) – Endpunkte, Socket.io, Reconnect, Bann
- [Frontend README](frontend/README.md) – Features, localStorage, Host-Audio
- [Game-State & Events](docs/game-state-and-events.md) – Phasen, Rollen, Socket-Events
