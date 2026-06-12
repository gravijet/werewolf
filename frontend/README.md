# Werwolf – Frontend

React (Vite) + Socket.io-Client. Mobile-First, Material Design, i18n (DE/EN), Host-Audio (deutsch).

## Voraussetzungen

- Node.js 18+
- Backend unter `http://localhost:5172` (oder `VITE_API_URL` setzen)

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

Öffne http://localhost:5173. Der Vite-Proxy leitet `/socket.io` und `/health` an http://localhost:5172 weiter. Läuft das Backend nicht, kann die Konsole Proxy-Fehler anzeigen – dann zuerst Backend starten.

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
- **Lobby:** Spielerliste, **Einladen/Link teilen** (Web Share + Kopieren), Host startet das Spiel.
- **Bürgermeisterwahl:** Kandidaten, Stimmen, Host beendet Wahl (optional abschaltbar).
- **Nacht:** Rollen-Anzeige, Aktionen (Werwolf/Seher/Hexe/Amor/Bäcker), dynamische Subphasen, Host schaltet weiter.
- **Tag:** Nachtopfer-Banner, Anklage + Abstimmung (inkl. Stichwahl), **Diskussions-Timer**, Host wertet aus.
- **Ergebnis:** Anzeige, Host startet nächste Runde.
- **Spielende:** Sieger-Feier mit **Konfetti**, **vollständige Rollen-Auflösung**, Spielprotokoll und **„Neue Runde"** (Host).
- **Tot:** Geist-Ansicht mit allen Rollen und Spielverlauf.
- **Admin:** Host wechseln, Spieler bannen/kicken, Regeln & Rollen konfigurieren.
- **Design:** Farbenfrohes Material-You-Design, **phasenabhängige Farbwelt**, **Dark Mode** (umschaltbar, oben rechts), sanfte Animationen.
- **i18n:** Sprache **DE / EN / SV** pro Spieler wählbar (Steuerungs-Cluster oben rechts).
- **Host-Audio:** Mehrsprachige Sprachanweisungen (Browser-Speech) auf dem Gerät des Hosts.

## localStorage

- `werwolf_playerId`, `werwolf_playerName`, `werwolf_canChangeName`, `werwolf_reconnectToken`
- `werwolf_lang` (DE/EN/SV)
- `werwolf_theme` (light/dark)
