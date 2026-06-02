# Deployment & Produktion

Anleitung für ein produktives Setup (Beispiel: Domain `gravijet.eu`, Backend hinter nginx).

## Architektur

```
Browser ──HTTPS──▶ nginx ──▶ /            → statische Frontend-Dateien (frontend/dist)
                         └─▶ /socket.io/  → Backend (Node, Port 5172)
                         └─▶ /health      → Backend
```

## 1. Umgebungsvariablen (Backend)

> **Security:** Passwörter niemals ins Repo committen. Immer über Umgebungsvariablen setzen.

| Variable          | Bedeutung | Beispiel |
|-------------------|-----------|----------|
| `PORT`            | Port des Backends | `5172` |
| `CORS_ORIGIN`     | Erlaubte Origin(s), kommagetrennt | `https://gravijet.eu` |
| `PLAYER_PASSWORD` | Zugangscode für Spieler | *(geheim)* |
| `ADMIN_PASSWORD`  | Zugangscode für die Spielleitung | *(geheim)* |
| `WERWOLF_DATA_DIR`| Optional: Verzeichnis für `state.json` | `/var/lib/werwolf` |

Entweder als echte Shell-Variablen exportieren oder eine nicht eingecheckte `backend/.env` anlegen
(siehe `backend/.env.example`). Fehlen die Passwörter, gelten die Dev-Defaults aus `constants.js`
(`WOLFGAME` / `WOLFGAMEADMIN`) – diese sind **nicht** für Produktion gedacht.

## 2. Build

```bash
# Backend
cd backend && npm ci

# Frontend (Backend-URL nur nötig, wenn anderer Origin)
cd ../frontend && npm ci
VITE_API_URL=https://gravijet.eu npm run build   # Ausgabe in frontend/dist
```

Bei Betrieb hinter nginx mit gemeinsamem Origin kann `VITE_API_URL` leer bleiben – der Client
verbindet sich dann mit dem eigenen Origin.

## 3. Backend mit pm2

```bash
export PLAYER_PASSWORD="…"
export ADMIN_PASSWORD="…"
export CORS_ORIGIN="https://gravijet.eu"
pm2 start ecosystem.config.js
pm2 save
```

`ecosystem.config.js` liest die Passwörter aus der Shell-Umgebung (keine Klartext-Geheimnisse im
Repo). Graceful Shutdown (SIGINT/SIGTERM) speichert den State und schließt offene Verbindungen.

## 4. nginx

Siehe `nginx.conf` im Projektroot. Wichtig:

- `location /` → `frontend/dist` mit SPA-Fallback (`try_files … /index.html`)
- `location /socket.io/` → WebSocket-Proxy auf das Backend (Upgrade-Header!)
- `location /health` → Backend-Health-Check
- TLS via Let's Encrypt; Security-Header gesetzt

```bash
sudo cp nginx.conf /etc/nginx/sites-available/gravijet.eu
sudo ln -s /etc/nginx/sites-available/gravijet.eu /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 5. Health-Check & Monitoring

`GET /health` liefert:

```json
{ "ok": true, "service": "werwolf-service", "phase": "lobby", "players": 0, "uptime": 42 }
```

Eignet sich für Uptime-Checks und Load-Balancer-Probes.

## 6. Sicherheit (Kurzcheck)

- [x] Passwörter nur via Umgebungsvariablen (nicht im Repo)
- [x] CORS auf die echte Domain begrenzen (`CORS_ORIGIN`)
- [x] Rate-Limiting pro Verbindung (Server) gegen Event-Spam & Passwort-Raten
- [x] Payload-Größe begrenzt (`maxHttpBufferSize`, JSON-Limit)
- [x] Security-Header (nginx **und** Express)
- [x] Sensible Felder (Token/IP/Fingerprint) werden nie an Clients gesendet

## 7. Updates / Neustart

```bash
git pull
cd frontend && npm ci && npm run build
pm2 restart werwolf-backend
```

Nach einem Neustart beginnt das Backend bewusst mit einer leeren Lobby.
