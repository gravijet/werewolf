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

test("Hexe darf Heil- und Gifttrank in derselben Nacht einsetzen", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ hexe: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const all = ["p0", "p1", "p2", "p3"].map((id) => gs.findPlayer(id));
  const hexe = all.find((p) => p.role === "hexe");
  const villagers = all.filter((p) => p.role === "dorfbewohner");
  const victim = villagers[0];
  const poisonTarget = villagers[1];

  // Werwölfe wählen ein Opfer (Host gibt es ein).
  assert.equal(gs.getState(null).night.subPhase, "werwolf");
  gs.submitNightAction("host", { targetId: victim.playerId });
  let r = gs.advanceNightPhase("host");
  assert.equal(r.subPhase, "hexe");

  // Hexe heilt das Opfer UND vergiftet eine andere Person.
  const res = gs.submitNightAction(hexe.playerId, { healId: victim.playerId, poisonId: poisonTarget.playerId });
  assert.ok(res.ok);
  gs.advanceNightPhase("host");

  assert.equal(gs.findPlayer(victim.playerId).isAlive, true, "geheiltes Werwolf-Opfer lebt");
  assert.equal(gs.findPlayer(poisonTarget.playerId).isAlive, false, "vergiftetes Ziel ist ausgeschieden");
});

test("Amor: erneute Wahl hebt das alte Liebespaar auf", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ amor: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const all = ["p0", "p1", "p2", "p3"].map((id) => gs.findPlayer(id));
  const amor = all.find((p) => p.role === "amor");
  const others = all.filter((p) => p.playerId !== amor.playerId);
  assert.equal(gs.getState(null).night.subPhase, "amor");

  // Erstes Liebespaar.
  gs.submitNightAction(amor.playerId, { lover1Id: others[0].playerId, lover2Id: others[1].playerId });
  assert.equal(gs.findPlayer(others[0].playerId).inLove, true);
  assert.equal(gs.findPlayer(others[1].playerId).inLove, true);

  // Amor ändert die Wahl: others[0] bleibt, others[2] kommt neu dazu.
  gs.submitNightAction(amor.playerId, { lover1Id: others[0].playerId, lover2Id: others[2].playerId });
  const inLove = all.map((p) => gs.findPlayer(p.playerId)).filter((p) => p.inLove);
  assert.equal(inLove.length, 2, "es gibt genau zwei Verliebte");
  assert.equal(Boolean(gs.findPlayer(others[1].playerId).inLove), false, "altes Paar-Mitglied ist nicht mehr verliebt");
  assert.equal(gs.findPlayer(others[0].playerId).inLove, true);
  assert.equal(gs.findPlayer(others[2].playerId).inLove, true);
});

test("Seher kann die Spielleitung (Moderator) nicht prüfen", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ seher: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const all = ["p0", "p1", "p2", "p3"].map((id) => gs.findPlayer(id));
  const seher = all.find((p) => p.role === "seher");
  const villager = all.find((p) => p.role === "dorfbewohner");

  gs.advanceNightPhase("host"); // werwolf -> seher
  assert.equal(gs.getState(null).night.subPhase, "seher");

  // Host darf nicht geprüft werden (Host-Sicht zeigt die ungemaskten Aktionen).
  gs.submitNightAction(seher.playerId, { targetId: "host" });
  assert.equal(gs.getState("host").night.actions.seher.targetId, null, "Moderator ist kein gültiges Ziel");

  // Eine echte Person darf geprüft werden.
  gs.submitNightAction(seher.playerId, { targetId: villager.playerId });
  assert.equal(gs.getState("host").night.actions.seher.targetId, villager.playerId);
});
