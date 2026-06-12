# Werwolf – Backend

Node.js (Express) + Socket.io für einen einzigen aktiven Spielraum. Spielzustand nur im Speicher (kein persistenter Store).

## Voraussetzungen

- Node.js 18+

## Installation

```bash
cd backend
npm install
```

## Start

```bash
npm start
```

Dev mit Auto-Reload:

```bash
npm run dev
```

Server läuft auf `http://localhost:5172` (oder `PORT` aus Umgebung).

## Tests

```bash
npm test
```

Verwendet den eingebauten Node-Test-Runner (keine zusätzlichen Abhängigkeiten). Abgedeckt sind die
Rollen-Engine (Verteilung, Überlauf, Auffüllen) und die Spiellogik (Host-Vergabe, Rollenvergabe,
dynamische Nacht-Phasen, Rollen-Enthüllung am Ende, Neustart).

## Endpunkte

- `GET /health` – Health-Check, JSON `{ ok, service, phase, players, uptime }`

## Sicherheit & Robustheit

- **Rate-Limiting** pro Verbindung (strenger für `join`, schützt vor Passwort-Raten/Spam).
- Alle Socket-Handler sind in Fehler-Kapselung gewrappt – ein Fehler bringt den Server nicht aus dem Tritt.
- Begrenzte Payload-Größe (`maxHttpBufferSize`, JSON-Limit) und CORS über `CORS_ORIGIN`.
- Sensible Felder (`reconnectToken`, `ip`, `fingerprint`) werden nie an Clients gesendet.
- Graceful Shutdown bei SIGINT/SIGTERM (State wird gesichert).

## Socket.io

Alle Clients verbinden sich mit demselben Raum. Siehe `docs/game-state-and-events.md` für Events und Game-State.

### Passwörter & Umgebung

- Spieler: `WOLFGAME` (überschreibbar mit `PLAYER_PASSWORD`)
- Admin: `WOLFGAMEADMIN` (überschreibbar mit `ADMIN_PASSWORD`)
- **Einladungs-Token:** Alternativ zum Passwort erlaubt `join` ein `inviteToken` (aus dem geteilten Link `/nopassword?t=<token>`). Das Token ist nur für beigetretene Mitglieder im State sichtbar, überlebt Server-Neustarts und rotiert bei jedem Spiel-Reset.

Optional: `.env` im Ordner `backend/` anlegen (wird via `dotenv` geladen). Siehe `.env.example`.

## Reconnect

Client sendet beim erneuten Verbinden `join` mit `playerId` und `reconnectToken` (aus localStorage). Der Server ordnet den Socket dem bestehenden Spieler zu und sendet den aktuellen State.

## Bann & Kicken

- **Admin:** Spieler bannen (`admin_ban`) – gebannte Spieler erhalten `join_error` und werden getrennt.
- **Host/Admin:** Spieler kicken (`host_kick`) – Spieler wird nur aus dem Raum entfernt, nicht gebannt.

## Persistenz & Neustart

Der Spielzustand (und Bans) wird in `data/state.json` gespeichert (Ordner wird automatisch angelegt). Beim Start des Servers wird geladen, falls die Datei existiert – nach einem Absturz kann so fortgesetzt werden. Speicherort änderbar über `WERWOLF_DATA_DIR`.

## CLI (Konsole)

Während der Server läuft, können in der gleichen Konsole Befehle eingegeben werden:

- `list` – Spieler auflisten
- `state` – Phase und Runde
- `kick <playerId>` – Spieler kicken
- `ban <playerId>` – Spieler bannen (Server-Admin)
- `unban <playerId>` – Bann aufheben
- `end` – Spiel sofort beenden
- `reset` – State zurücksetzen (Lobby, keine Spieler)
- `help` – Hilfe anzeigen
