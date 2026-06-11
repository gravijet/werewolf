# Game-State & Socket-Events

Dieses Dokument beschreibt das State-Modell, die Spielphasen und alle Socket.io-Events.

## Überblick

Ein einziger aktiver Spielraum, vollständig im Speicher gehalten (`backend/src/game-state.js`).
Der Zustand wird zusätzlich debounced nach `data/state.json` persistiert (Backup bei Absturz;
beim Start wird bewusst **nicht** geladen, es startet immer eine leere Lobby).

Das Spiel ist **moderator-geführt**: Der Host (Rolle `moderator`) steuert die Phasen, ruft die
Rollen auf und gibt z. B. das Werwolf-Opfer ein. Die Mitspieler stimmen über ihre Geräte ab.

## Phasen

```
lobby → mayor_election → night → day → result → (night → day → result …) → game_end
                              ↘ jaeger_shot ↗
```

| Phase            | Bedeutung |
|------------------|-----------|
| `lobby`          | Spieler treten bei; Host konfiguriert Regeln und startet. |
| `mayor_election` | Optionale Bürgermeisterwahl (per Regel abschaltbar). |
| `night`          | Nacht mit dynamischen Subphasen (siehe unten). |
| `day`            | Anklage (`accusing`) → Abstimmung (`voting`) → Entscheidung. |
| `result`         | Zusammenfassung der Runde; Host startet die nächste. |
| `jaeger_shot`    | Sonderphase: ausgeschiedener Jäger gibt einen letzten Schuss ab. |
| `game_end`       | Spielende; **alle Rollen werden enthüllt**. |

### Dynamische Nacht-Subphasen

`getNightSubphases()` baut die Reihenfolge anhand der **lebenden** Rollen:

- `amor` – nur in der ersten Nacht, wenn ein lebender Amor existiert
- `beschuetzer` – jede Nacht, wenn ein Beschützer lebt (legt den Schutz vor den Werwölfen)
- `werwolf` – immer (Anker; Host gibt das Opfer ein)
- `seher` – nur, wenn ein Seher lebt
- `hexe` – nur, wenn die Hexe lebt **und** noch einen Trank hat
- `baecker` – nur, wenn ein Bäcker lebt

Dadurch klickt der Host nicht mehr durch leere Phasen.

## Rollen

| Rolle             | Team    | Kurz |
|-------------------|---------|------|
| `werwolf`         | Werwölfe | Wählt nachts ein Opfer. |
| `seher`           | Dorf    | Prüft nachts eine Person (Gut/Böse oder exakte Rolle, je nach Regel). |
| `hexe`            | Dorf    | Ein Heil- und ein Gifttrank, je einmal pro Partie. |
| `dorfbewohner`    | Dorf    | Keine Nachtaktion. |
| `amor`            | Dorf    | Bestimmt in Nacht 1 das Liebespaar. |
| `kopfgeldjaeger`  | Solo    | Bekommt zu Spielbeginn eine ausgeloste Zielperson; gewinnt, wenn genau sie am Tag gelyncht wird. |
| `jaeger`          | Dorf    | Schießt beim Ausscheiden auf eine Person. |
| `blinzelmaedchen` | Dorf    | Darf nachts die Werwölfe „erspähen". |
| `baecker`         | Dorf    | Schaltet eine Person für den nächsten Tag stumm. |
| `beschuetzer`     | Dorf    | Schützt jede Nacht eine Person vor den Werwölfen (nicht zweimal dieselbe in Folge). |
| `aelteste`        | Dorf    | Übersteht den ersten Werwolf-Angriff der Partie (still, ohne Log). Gift, Abstimmung und Jäger-Schuss wirken normal. |
| `moderator`       | –       | Der Host; spielt nicht aktiv mit. |

Die Verteilung erfolgt in `roles-engine.js`. `count` kann `"1/3"` (Werwölfe) oder eine feste Zahl
sein. Überzählige Rollen werden zuerst bei Dorfbewohnern, dann Werwölfen abgebaut – Spezialrollen
bleiben erhalten. Der Rest wird mit Dorfbewohnern aufgefüllt.

### Siegbedingungen (`checkWinCondition`)

- **Liebespaar** (`lovers`): genau die beiden Verliebten überleben.
- **Werwölfe** (`werwolf`): Werwölfe ≥ Nicht-Werwölfe.
- **Dorf** (`village`): kein Werwolf lebt mehr.
- **Kopfgeldjäger** (`kopfgeldjaeger`): seine zu Spielbeginn ausgeloste Zielperson wird am Tag
  gelyncht (greift in der regulären Abstimmung und beim Zufalls-Stichentscheid).

## Sichtbarkeit / Masking

`getState(viewerPlayerId)` maskiert sensible Daten pro Betrachter:

- Eigene Rolle immer sichtbar; fremde Rollen nur für Tote (falls Regel aktiv), den Moderator oder
  **am Spielende**.
- Nachtaktionen werden so maskiert, dass nur die jeweils berechtigte Rolle ihr Ergebnis sieht
  (z. B. sieht nur der Seher sein Prüf-Ergebnis; die Hexe sieht das Werwolf-Opfer).
- `reconnectToken`, `fingerprint` und `ip` werden **nie** an Clients gesendet.

## Socket-Events

### Client → Server

| Event              | Payload | Wer |
|--------------------|---------|-----|
| `join`             | `{ playerName, password, playerId?, reconnectToken?, fingerprint? }` | alle |
| `set_name`         | `{ newName }` | Spieler (wenn erlaubt) |
| `start_game`       | – | Host/Admin |
| `restart_game`     | – | Host/Admin (nur nach `game_end`) |
| `mayor_vote`       | `{ targetPlayerId }` | Spieler |
| `mayor_phase_next` | – | Host/Admin |
| `host_set_mayor`   | `{ mayorPlayerId }` | Host/Admin |
| `night_action`     | `{ targetId?, healId?, poisonId?, lover1Id?, lover2Id? }` | rollenabhängig |
| `day_accuse`       | `{ targetPlayerId }` | Spieler |
| `day_vote`         | `{ targetPlayerId }` | Spieler |
| `phase_next`       | – | Host/Admin |
| `host_skip_phase`  | – | Host/Admin |
| `jaeger_kill`      | `{ targetId }` | Host/Admin |
| `admin_set_rules`  | `{ rules }` | Host/Admin (nur Lobby) |
| `admin_change_name`| `{ targetPlayerId, newName }` | Host/Admin |
| `admin_lock_name`  | `{ targetPlayerId, lock }` | Host/Admin |
| `admin_set_host`   | `{ targetPlayerId }` | Host/Admin |
| `host_kick`        | `{ targetPlayerId }` | Host/Admin |
| `admin_ban`        | `{ targetPlayerId }` | Admin |
| `admin_unban`      | `{ targetPlayerId }` | Admin |

Alle Handler sind serverseitig mit **Rate-Limiting** (pro Verbindung) und **Fehler-Kapselung**
versehen. `join` ist strenger limitiert (Schutz gegen Passwort-Raten).

### Server → Client

| Event            | Payload |
|------------------|---------|
| `state`          | Kompletter, betrachterspezifisch maskierter State |
| `joined`         | `{ playerId, reconnectToken, canChangeName, isAdmin, isHost }` |
| `join_error`     | `{ code, message }` (z. B. `wrong_password`, `banned`, `room_full`) |
| `error`          | `{ code, message }` (z. B. `rate_limited`, `server_error`) |
| `player_joined` / `player_left` / `player_updated` / `player_banned` | Sync-Hinweise |
| `phase_changed`  | `{ phase, round }` |
| `mayor_result`   | `{ mayorId, mayorName }` |
| `night_victim`   | `{ victimId, victimName }` |
| `vote_result`    | `{ eliminatedId, eliminatedName }` oder `{ runoff: true }` |
| `game_end`       | `{ winner }` |

## Reconnect

Der Client speichert `playerId` + `reconnectToken` (localStorage/Cookie). Beim erneuten Verbinden
wird `join` mit diesen Werten gesendet; der Server ordnet die bestehende Identität zu.
Namens-Kollisionen werden **nicht** als Reconnect behandelt.
