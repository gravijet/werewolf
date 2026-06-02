import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Persistenz in ein temporäres Verzeichnis lenken, bevor das Modul geladen wird.
process.env.WERWOLF_DATA_DIR = mkdtempSync(join(tmpdir(), "werwolf-test-"));

const gs = await import("../src/game-state.js");
const { DEFAULT_RULES } = await import("../src/constants.js");

const FULL_ROLES = (over = {}) => ({
  werwolf: { count: 1, enabled: true },
  seher: { count: 0, enabled: false },
  hexe: { count: 0, enabled: false },
  dorfbewohner: { count: 1, enabled: true },
  amor: { count: 0, enabled: false },
  kopfgeldjaeger: { count: 0, enabled: false },
  jaeger: { count: 0, enabled: false },
  blinzelmaedchen: { count: 0, enabled: false },
  baecker: { count: 0, enabled: false },
  ...over,
});

function setupLobby(numPlayers, rules) {
  gs.resetState();
  gs.addPlayer({ playerId: "host", name: "Mod", reconnectToken: "th" });
  gs.ensureHost();
  for (let i = 0; i < numPlayers; i++) {
    gs.addPlayer({ playerId: "p" + i, name: "P" + i, reconnectToken: "t" + i });
  }
  if (rules) gs.adminSetRules("host", rules);
}

test("maxPlayers ist endlich (JSON-sicher)", () => {
  assert.ok(Number.isFinite(DEFAULT_RULES.maxPlayers));
});

test("ensureHost macht den ersten Spieler zum Host", () => {
  setupLobby(3);
  assert.equal(gs.findPlayer("host").isHost, true);
  assert.equal(gs.findPlayer("p0").isHost, false);
});

test("startGame verteilt Rollen und macht Host zum Moderator", () => {
  setupLobby(5, { mayorElectionEnabled: false, roles: FULL_ROLES({ seher: { count: 1, enabled: true } }) });
  const res = gs.startGame("host");
  assert.ok(res.ok);
  assert.equal(gs.getState(null).phase, "night");
  assert.equal(gs.findPlayer("host").role, "moderator");

  const roles = ["p0", "p1", "p2", "p3", "p4"].map((id) => gs.findPlayer(id).role);
  assert.equal(roles.length, 5);
  assert.ok(roles.every(Boolean), "alle Spieler haben eine Rolle");
  assert.equal(roles.filter((r) => r === "werwolf").length, 1);
  assert.equal(roles.filter((r) => r === "seher").length, 1);
});

test("startGame scheitert bei zu wenigen Spielern", () => {
  setupLobby(2);
  const res = gs.startGame("host");
  assert.equal(res.ok, false);
  assert.equal(res.error, "not_enough_players");
});

test("startGame nur durch Host/Admin", () => {
  setupLobby(5);
  const res = gs.startGame("p0");
  assert.equal(res.ok, false);
  assert.equal(res.error, "not_host");
});

test("Nacht-Subphasen: ohne Spezialrollen ist Werwolf der Anker", () => {
  setupLobby(5, { mayorElectionEnabled: false, roles: FULL_ROLES() });
  gs.startGame("host");
  assert.equal(gs.getState(null).night.subPhase, "werwolf");
});

test("Nacht-Subphasen: Seher kommt nur vor, wenn ein Seher lebt", () => {
  setupLobby(6, { mayorElectionEnabled: false, roles: FULL_ROLES({ seher: { count: 1, enabled: true } }) });
  gs.startGame("host");
  // Erste Subphase ist Werwolf; danach muss Seher folgen (er lebt).
  const r = gs.advanceNightPhase("host");
  assert.ok(r.ok);
  assert.equal(r.subPhase, "seher");
});

test("Spielende enthüllt alle Rollen für alle Betrachter", () => {
  setupLobby(5, { mayorElectionEnabled: false, roles: FULL_ROLES() });
  gs.startGame("host");
  gs.endGameNow("village");
  const view = gs.getState(null); // neutraler Betrachter
  assert.equal(view.phase, "game_end");
  assert.ok(view.players.some((p) => p.role), "Rollen sind am Ende sichtbar");
});

test("restartToLobby setzt zurück und behält Spieler", () => {
  setupLobby(5, { mayorElectionEnabled: false, roles: FULL_ROLES() });
  gs.startGame("host");
  gs.endGameNow("village");
  const res = gs.restartToLobby("host");
  assert.ok(res.ok);
  const s = gs.getState(null);
  assert.equal(s.phase, "lobby");
  assert.equal(s.players.length, 6); // Host + 5
  assert.equal(gs.findPlayer("p0").role, null);
  assert.equal(gs.findPlayer("p0").isAlive, true);
});

test("restartToLobby nur nach Spielende erlaubt", () => {
  setupLobby(5, { mayorElectionEnabled: false, roles: FULL_ROLES() });
  gs.startGame("host");
  const res = gs.restartToLobby("host");
  assert.equal(res.ok, false);
});
