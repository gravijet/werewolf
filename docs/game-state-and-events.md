# Werwolf Jugend – Game-State-Modell & Socket-Events

## 1. Game-State (JSON-Struktur)

Der komplette Spielzustand liegt auf dem Server. Ein einziger aktiver Spielraum.

### 1.1 Phasen (phase)

```ts
type GamePhase =
  | "lobby"           // Warten auf Spieler, Host kann starten
  | "mayor_election"  // Bürgermeisterwahl (nach Spielstart)
  | "night"           // Nacht – Rollen handeln
  | "day"             // Tag – Diskussion & Abstimmung
  | "result"          // Ergebnis (Lynchopfer / Nachtopfer bekannt)
  | "game_end";       // Sieg einer Fraktion
```

### 1.2 Spieler (players)

```json
{
  "playerId": "uuid-v4",
  "name": "Max M.",
  "isAdmin": false,
  "isHost": false,
  "canChangeName": true,
  "isConnected": true,
  "isAlive": true,
  "role": "werwolf",
  "isMayor": false,
  "reconnectToken": "opaque-token",
  "joinedAt": "ISO8601",
  "lastSeenAt": "ISO8601"
}
```

- **role** nur gesetzt, sobald das Spiel gestartet wurde (und für den Client nur die eigene Rolle bzw. für Tote alle Rollen).
- **reconnectToken** wird bei erstem Join gesetzt und für Reconnect verwendet.
- **canChangeName**: von Admin änderbar (Namenssperre).

### 1.3 Rollen (Referenz Werwolf-Wiki)

Standard-Set (nur diese für automatische Verteilung, sofern aktiviert):

- **Werwolf** (Anzahl ≈ 1/3 der Spieler)
- **Seher** (1)
- **Hexe** (1)
- **Dorfbewohner** (nur wenn explizit aktiviert, sonst keine „Füllrolle“)

Weitere Rollen aus https://werwolf.fandom.com/de/wiki/Rollen können in `rules.roles` konfigurierbar sein (z. B. Amor, Kopfgeldjäger); die Verteilung bleibt automatisch.

### 1.4 Regeln/Konfiguration (rules)

```json
{
  "minPlayers": 6,
  "maxPlayers": 200,
  "voteDurationSeconds": 180,
  "mayorElectionEnabled": true,
  "revealRolesToDead": true,
  "roles": {
    "werwolf": { "count": "1/3", "enabled": true },
    "seher": { "count": 1, "enabled": true },
    "hexe": { "count": 1, "enabled": true },
    "dorfbewohner": { "count": 0, "enabled": false },
    "amor": { "count": 1, "enabled": false },
    "kopfgeldjaeger": { "count": 1, "enabled": false }
  }
}
```

- **count**: Zahl oder `"1/3"` für Werwölfe (Anteil der Spieler).
- Nur Rollen mit `enabled: true` werden verteilt; Dorfbewohner nur bei `dorfbewohner.enabled === true`.

### 1.5 Bürgermeisterwahl (mayorElection)

```json
{
  "candidateIds": ["id1", "id2"],
  "votes": { "playerId": "targetPlayerId" },
  "round": 1,
  "status": "voting",
  "mayorId": null
}
```

- **status**: `"voting"` | `"tie_redo"` (Stichwahl) | `"decided"`.
- **mayorId**: nach Abschluss gesetzt.

### 1.6 Nacht (night)

```json
{
  "round": 1,
  "subPhase": "werwolf",
  "actions": {
    "werwolf": { "targetId": null },
    "seher": { "targetId": null },
    "hexe": { "healId": null, "poisonId": null }
  },
  "victimId": null
}
```

- **subPhase**: Reihenfolge der Nachtaktionen (werwolf, seher, hexe, …).
- **victimId**: nach Nachtende: wer getötet wurde (Werwolf-Opfer, ggf. Hexe).

### 1.7 Tag/Abstimmung (day)

```json
{
  "round": 1,
  "votes": { "voterPlayerId": "targetPlayerId" },
  "eliminatedId": null,
  "tieResolution": null
}
```

- **tieResolution**: bei Gleichstand: `"runoff"` (Stichwahl), `"mayor_decides"`, oder `"new_mayor_election"` (wenn kein Bürgermeister).

### 1.8 Stimmgewicht Bürgermeister

- Normal: 1 Stimme.
- Bei exaktem Gleichstand (z. B. 5:5) zählt die Stimme des Bürgermeisters doppelt → seine Seite gewinnt (6:5).
- Kein „doppelt zählen“ außer im Gleichstand.

### 1.9 Bans (server-seitig)

```json
{
  "playerIds": ["id1", "id2"],
  "fingerprints": ["fp1"],
  "ips": ["1.2.3.4"]
}
```

- Eintrag in einer der Listen verhindert Join/Reconnect.

### 1.10 Spiel-Log (gameLog)

Für Tote und Host sichtbar:

```json
[
  { "round": 1, "phase": "night", "messageKey": "victim_werwolf", "playerName": "Jana T.", "at": "ISO8601" },
  { "round": 1, "phase": "day", "messageKey": "lynch", "playerName": "Felix P.", "at": "ISO8601" }
]
```

### 1.11 Vollständiger Game-State (Root)

```json
{
  "phase": "lobby",
  "roomCode": "WOLF",
  "players": [],
  "rules": { /* siehe 1.4 */ },
  "mayorElection": null,
  "night": null,
  "day": null,
  "gameLog": [],
  "winner": null,
  "round": 0
}
```

- **winner**: `"village"` | `"werwolf"` | `"lovers"` | `"kopfgeldjaeger"` | null.
- **round**: aktuelle Runde (0 = Lobby, 1 = erste Nacht/Tag usw.).

---

## 2. Socket-Events

### 2.1 Client → Server

| Event | Payload | Beschreibung |
|-------|---------|--------------|
| **join** | `{ playerName, password, reconnectToken?, playerId?, fingerprint? }` | Neuer Spieler oder Reconnect. Bei Reconnect: `playerId` + `reconnectToken` reichen; `playerName` optional. |
| **set_name** | `{ newName }` | Namen ändern (nur wenn `canChangeName`). |
| **start_game** | `{}` | Host startet das Spiel (nur in `lobby`). Rollen werden automatisch verteilt (Rollen-Engine). |
| **mayor_vote** | `{ targetPlayerId }` | Stimme bei Bürgermeisterwahl abgeben. |
| **mayor_phase_next** | `{}` | Host beendet Wahlphase und zeigt Ergebnis / startet Stichwahl. Bei Tag-Gleichstand ohne Bürgermeister kann hier die erzwungene Wahl stattfinden; danach geht es zurück in die Tag-Phase. |
| **night_action** | `{ targetId/targetPlayerId?, healId/heal?, poisonId/poison? }` | Nachtaktion (Werwolf: Ziel; Seher: Ziel; Hexe: Heil- und/oder Gifttrank-Ziel). |
| **phase_next** | `{}` | Host schaltet Phase: Nacht (nächste Subphase oder Nacht-Ende → Tag), Tag (Abstimmung auswerten → Ergebnis/Stichwahl), Ergebnis (nächste Runde Nacht oder Spielende). |
| **day_vote** | `{ targetPlayerId }` | Abstimmung am Tag (wen lynchen); bei Stichwahl nur Kandidaten in `day.runoffCandidates`. |
| **admin_change_name** | `{ targetPlayerId, newName }` | Admin: Namen eines Spielers ändern. |
| **admin_lock_name** | `{ targetPlayerId, lock: boolean }` | Admin: Namensänderung sperren (`canChangeName = !lock`). |
| **admin_ban** | `{ targetPlayerId, fingerprint?, ip? }` | Admin: Spieler bannen (playerId + optional Fingerprint/IP). |
| **admin_set_host** | `{ targetPlayerId }` | Admin: neuen Host setzen. |
| **admin_set_rules** | `{ rules }` | Admin: Regeln/Rollenkonfiguration setzen (nur in Lobby). |

### 2.2 Server → Client

| Event | Payload | Beschreibung |
|-------|---------|--------------|
| **state** | `GameState` (vollständig oder Teilmenge) | Aktueller Spielzustand (bei Join/Reconnect voll, sonst ggf. Delta). |
| **joined** | `{ playerId, reconnectToken, canChangeName, isAdmin, isHost }` | Erfolgreicher Join/Reconnect; Client speichert playerId, playerName, canChangeName, reconnectToken im localStorage. |
| **join_error** | `{ code, message }` | Join fehlgeschlagen (falsches Passwort, gebannt, Raum voll, Spiel bereits gestartet). |
| **player_joined** | `{ player }` | Neuer Spieler in der Lobby (für alle). |
| **player_left** | `{ playerId }` | Spieler getrennt (Disconnect). |
| **player_banned** | `{ playerId }` | Spieler wurde gebannt (für alle). |
| **player_updated** | `{ playerId, updates }` | Name/CanChangeName/Host/Admin geändert. |
| **phase_changed** | `{ phase, round? }` | Phase gewechselt. |
| **mayor_result** | `{ mayorId, mayorName }` | Bürgermeister gewählt. |
| **vote_result** | `{ eliminatedId, tie? }` | Ergebnis der Tagesabstimmung. |
| **night_victim** | `{ victimId, victimName }` | Opfer der Nacht (am Tag sichtbar). |
| **game_end** | `{ winner, reason? }` | Spiel beendet. |
| **error** | `{ code, message }` | Allgemeiner Fehler (z. B. ungültige Aktion). |

### 2.3 Persistenz Client (localStorage)

- **playerId**: nach erfolgreichem Join.
- **playerName**: aktueller Anzeigename.
- **canChangeName**: ob Namensänderung erlaubt ist.
- **reconnectToken**: für Reconnect (vom Server bei Join gesetzt).

Server speichert den Spielzustand; bei Reconnect sendet der Client `playerId` + `reconnectToken`, der Server prüft und ordnet den Socket dem bestehenden Spieler zu.

---

## 3. Gleichstand-Protokoll (Abstimmung Tag)

1. **Gleichstand** → Stichwahl zwischen den gleichtplatzierten Kandidaten.
2. **Erneut Gleichstand** → Bürgermeister-Regel: Seine Stimme zählt doppelt (nur in diesem Durchgang), seine Seite gewinnt.
3. **Kein Bürgermeister vorhanden** → Sofortige Bürgermeisterwahl, danach erneute Entscheidung (oder Stichwahl mit neuem Bürgermeister).

Diese Logik ist in der Backend-Funktion `countDayVotes()` und `resolveDayPhase()` umgesetzt (Stichwahl → Bürgermeister doppelt → ggf. Bürgermeisterwahl).
