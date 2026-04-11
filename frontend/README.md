# Werwolf – Frontend

React (Vite) + Socket.io-Client. Mobile-First, Material Design, i18n (DE/EN), Host-Audio (deutsch).

## Voraussetzungen

- Node.js 18+
- Backend unter `http://localhost:3000` (oder `VITE_API_URL` setzen)

## Installation

```bash
cd frontend
npm install
```

## Entwicklung

**Backend zuerst starten** (in `backend/`: `npm start`), dann:

```bash
npm run dev
```

Öffne http://localhost:5173. Der Vite-Proxy leitet `/socket.io` und `/health` an http://localhost:3000 weiter. Läuft das Backend nicht, kann die Konsole Proxy-Fehler anzeigen – dann zuerst Backend starten.

## Build

```bash
npm run build
```

Ausgabe in `dist/`. Für Produktion Backend-URL ggf. setzen:

```bash
VITE_API_URL=https://dein-backend.de npm run build
```

## Features

- **Join/Reconnect:** Name, Passwort (Spieler/Admin); bei Reconnect `playerId` + `reconnectToken` aus localStorage.
- **Lobby:** Raumcode, Spielerliste, Host startet das Spiel.
- **Bürgermeisterwahl:** Kandidaten, Stimmen, Host beendet Wahl.
- **Nacht:** Rollen-Anzeige, Aktionen (Werwolf/Seher/Hexe), Host schaltet Phase.
- **Tag:** Nachtopfer-Banner, Abstimmung (inkl. Stichwahl), Host wertet aus.
- **Ergebnis:** Anzeige, Host startet nächste Runde.
- **Spielende:** Sieg Dorf/Werwölfe.
- **Tot:** Geist-Ansicht mit allen Rollen und Spielverlauf.
- **Admin:** Host wechseln, Spieler bannen (nur in Lobby sichtbar/konfigurierbar).
- **i18n:** Sprache DE/EN pro Spieler wählbar (oben rechts auf dem Join-Screen).
- **Host-Audio:** Deutsche Sprachanweisungen (Browser-Speech) nur auf dem Gerät des Hosts bei Phasenwechsel.

## localStorage

- `werwolf_playerId`, `werwolf_playerName`, `werwolf_canChangeName`, `werwolf_reconnectToken`
- `werwolf_lang` (DE/EN)
