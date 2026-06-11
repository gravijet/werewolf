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

test("Beschützer schirmt das Werwolf-Opfer ab", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ beschuetzer: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const all = ["p0", "p1", "p2", "p3"].map((id) => gs.findPlayer(id));
  const beschuetzer = all.find((p) => p.role === "beschuetzer");
  const opfer = all.find((p) => p.role === "dorfbewohner");

  // Erste Subphase ist der Beschützer (vor den Werwölfen).
  assert.equal(gs.getState(null).night.subPhase, "beschuetzer");
  gs.submitNightAction(beschuetzer.playerId, { targetId: opfer.playerId });
  let r = gs.advanceNightPhase("host");
  assert.equal(r.subPhase, "werwolf");

  // Werwölfe greifen genau die geschützte Person an.
  gs.submitNightAction("host", { targetId: opfer.playerId });
  gs.advanceNightPhase("host");

  assert.equal(gs.findPlayer(opfer.playerId).isAlive, true, "geschütztes Opfer überlebt");
  assert.equal(gs.getState(null).night.victimId, null, "kein Nachtopfer");
});

test("Beschützer darf dieselbe Person nicht zwei Nächte hintereinander schützen", () => {
  setupLobby(5, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ beschuetzer: { count: 1, enabled: true }, dorfbewohner: { count: 3, enabled: true } }),
  });
  gs.startGame("host");
  const all = ["p0", "p1", "p2", "p3", "p4"].map((id) => gs.findPlayer(id));
  const beschuetzer = all.find((p) => p.role === "beschuetzer");
  const villagers = all.filter((p) => p.role === "dorfbewohner");
  const protectFirst = villagers[0];
  const wolfVictim = villagers[1];

  // Nacht 1: protectFirst schützen, Werwölfe reißen jemand anderen.
  gs.submitNightAction(beschuetzer.playerId, { targetId: protectFirst.playerId });
  gs.advanceNightPhase("host"); // -> werwolf
  gs.submitNightAction("host", { targetId: wolfVictim.playerId });
  gs.advanceNightPhase("host"); // -> tag
  assert.equal(gs.getState(null).phase, "day");

  // Tag 1 überspringen (keine Hinrichtung) -> Ergebnis -> Nacht 2.
  gs.hostSkipPhase("host");
  gs.advanceFromResult("host");
  assert.equal(gs.getState(null).night.subPhase, "beschuetzer");

  // Nacht 2: dieselbe Person darf nicht erneut geschützt werden.
  gs.submitNightAction(beschuetzer.playerId, { targetId: protectFirst.playerId });
  assert.equal(gs.getState(beschuetzer.playerId).night.actions.beschuetzer.targetId, null, "Wiederholung wird abgelehnt");

  // Eine andere lebende Person ist erlaubt.
  gs.submitNightAction(beschuetzer.playerId, { targetId: beschuetzer.playerId });
  assert.equal(gs.getState(beschuetzer.playerId).night.actions.beschuetzer.targetId, beschuetzer.playerId);
});

test("Kopfgeldjäger gewinnt, wenn das Dorf seine Zielperson hinauswählt", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ kopfgeldjaeger: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const ids = ["p0", "p1", "p2", "p3"];
  const hunter = ids.map((id) => gs.findPlayer(id)).find((p) => p.role === "kopfgeldjaeger");
  const targetId = gs.getState(hunter.playerId).players.find((p) => p.playerId === hunter.playerId).bountyTargetId;
  assert.ok(targetId, "Kopfgeldjäger hat eine ausgeloste Zielperson");

  // Nacht ohne Nachtopfer durchlaufen (Werwölfe wählen niemanden).
  gs.advanceNightPhase("host");
  assert.equal(gs.getState(null).phase, "day");

  // Anklage + Abstimmung gegen die Zielperson.
  const voters = ids.map((id) => gs.findPlayer(id)).filter((p) => p.playerId !== targetId && p.isAlive);
  voters.forEach((v) => gs.submitDayAccusation(v.playerId, targetId));
  gs.resolveDayPhase("host"); // accusing -> voting
  voters.forEach((v) => gs.submitDayVote(v.playerId, targetId));
  const res = gs.resolveDayPhase("host");

  assert.equal(res.winner, "kopfgeldjaeger");
  assert.equal(gs.getState(null).phase, "game_end");
  assert.equal(gs.getState(null).winner, "kopfgeldjaeger");
});

test("Werwölfe gewinnen, wenn sie nachts die Gleichzahl erreichen", () => {
  setupLobby(3, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ werwolf: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const all = ["p0", "p1", "p2"].map((id) => gs.findPlayer(id));
  const villager = all.find((p) => p.role === "dorfbewohner");

  gs.submitNightAction("host", { targetId: villager.playerId });
  const r = gs.advanceNightPhase("host");
  assert.equal(r.winner, "werwolf");
  assert.equal(gs.getState(null).phase, "game_end");
});

test("Dorf gewinnt, wenn der letzte Werwolf hinausgewählt wird", () => {
  setupLobby(3, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ werwolf: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const ids = ["p0", "p1", "p2"];
  const wolf = ids.map((id) => gs.findPlayer(id)).find((p) => p.role === "werwolf");

  gs.advanceNightPhase("host"); // kein Nachtopfer -> Tag
  const voters = ids.map((id) => gs.findPlayer(id)).filter((p) => p.playerId !== wolf.playerId);
  voters.forEach((v) => gs.submitDayAccusation(v.playerId, wolf.playerId));
  gs.resolveDayPhase("host");
  voters.forEach((v) => gs.submitDayVote(v.playerId, wolf.playerId));
  const res = gs.resolveDayPhase("host");

  assert.equal(res.winner, "village");
  assert.equal(gs.getState(null).winner, "village");
});

test("Stichwahl beschränkt die Abstimmung auf die gleichstehenden Kandidaten", () => {
  setupLobby(5, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ dorfbewohner: { count: 4, enabled: true } }),
  });
  gs.startGame("host");
  const ids = ["p0", "p1", "p2", "p3", "p4"];
  gs.advanceNightPhase("host"); // kein Nachtopfer -> Tag

  // Drei Personen werden angeklagt: p0, p1, p2.
  gs.submitDayAccusation("p3", "p0");
  gs.submitDayAccusation("p4", "p1");
  gs.submitDayAccusation("p0", "p2");
  gs.resolveDayPhase("host"); // accusing -> voting (accusedIds = p0,p1,p2)

  // Gleichstand zwischen p0 und p1 (je 2), p2 bekommt nur 1 Stimme.
  gs.submitDayVote("p3", "p0");
  gs.submitDayVote("p2", "p0");
  gs.submitDayVote("p4", "p1");
  gs.submitDayVote("p0", "p1");
  gs.submitDayVote("p1", "p2");
  const res = gs.resolveDayPhase("host");
  assert.ok(res.runoff, "Gleichstand löst eine Stichwahl aus");

  const runoff = gs.getState(null).day.runoffCandidates;
  assert.deepEqual([...runoff].sort(), ["p0", "p1"], "Stichwahl nur zwischen p0 und p1");

  // p2 war angeklagt, steht aber nicht in der Stichwahl -> Stimme ist ungültig.
  const badVote = gs.submitDayVote("p3", "p2");
  assert.equal(badVote.ok, false, "Stimme für Nicht-Stichwahl-Kandidat wird abgelehnt");

  // Stimme für einen Stichwahl-Kandidaten ist erlaubt.
  const goodVote = gs.submitDayVote("p3", "p0");
  assert.equal(goodVote.ok, true);
});

test("Niemand wird hingerichtet, wenn keine Stimme abgegeben wird", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ dorfbewohner: { count: 3, enabled: true } }),
  });
  gs.startGame("host");
  gs.advanceNightPhase("host"); // -> Tag

  // Nur eine Person wird angeklagt, aber niemand stimmt ab.
  gs.submitDayAccusation("p1", "p0");
  gs.resolveDayPhase("host"); // accusing -> voting
  const res = gs.resolveDayPhase("host"); // auswerten ohne Stimmen

  assert.equal(res.eliminatedId, null, "ohne Stimmen wird niemand hingerichtet");
  assert.equal(gs.findPlayer("p0").isAlive, true, "der Angeklagte überlebt");
  assert.equal(gs.getState(null).phase, "result");
});

test("Jäger schießt auch dann, wenn sein Nacht-Tod das Spiel zu entscheiden scheint", () => {
  setupLobby(3, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({
      werwolf: { count: 1, enabled: true },
      jaeger: { count: 1, enabled: true },
      dorfbewohner: { count: 1, enabled: true },
    }),
  });
  gs.startGame("host");
  const all = ["p0", "p1", "p2"].map((id) => gs.findPlayer(id));
  const wolf = all.find((p) => p.role === "werwolf");
  const jaeger = all.find((p) => p.role === "jaeger");

  // Werwolf reißt den Jäger: Dorf (Jäger + Dorfbewohner) und Werwolf wären
  // danach gleichauf -> ohne Jäger-Schuss hätte der Werwolf "gewonnen".
  gs.submitNightAction("host", { targetId: jaeger.playerId });
  const r = gs.advanceNightPhase("host");
  assert.equal(r.phase, "jaeger_shot", "der Jäger darf vor der Siegprüfung schießen");

  // Der sterbende Jäger erschießt den Werwolf -> das Dorf gewinnt doch.
  const res = gs.submitJaegerKill("host", wolf.playerId);
  assert.equal(res.winner, "village");
  assert.equal(gs.getState(null).winner, "village");
});

test("startGame verlangt mindestens einen Werwolf", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ werwolf: { count: 0, enabled: false }, dorfbewohner: { count: 4, enabled: true } }),
  });
  const res = gs.startGame("host");
  assert.equal(res.ok, false);
  assert.equal(res.error, "no_werewolf");
  // Der State bleibt unangetastet in der Lobby.
  assert.equal(gs.getState(null).phase, "lobby");
});

test("Der Älteste überlebt den ersten Werwolf-Angriff, nicht den zweiten", () => {
  setupLobby(3, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ aelteste: { count: 1, enabled: true }, dorfbewohner: { count: 1, enabled: true } }),
  });
  gs.startGame("host");
  const all = ["p0", "p1", "p2"].map((id) => gs.findPlayer(id));
  const elder = all.find((p) => p.role === "aelteste");

  // Nacht 1: Werwölfe greifen den Ältesten an – er überlebt still.
  gs.submitNightAction("host", { targetId: elder.playerId });
  gs.advanceNightPhase("host");
  assert.equal(gs.findPlayer(elder.playerId).isAlive, true, "Der Älteste überlebt den ersten Angriff");
  assert.equal(gs.getState(null).night.victimId, null, "kein Nachtopfer");
  assert.equal(gs.getState(null).phase, "day");

  // Nur der Älteste selbst sieht, dass sein Extra-Leben verbraucht ist.
  const ownView = gs.getState(elder.playerId).players.find((p) => p.playerId === elder.playerId);
  assert.equal(ownView.elderUsedLife, true);
  const otherId = all.find((p) => p.playerId !== elder.playerId).playerId;
  const otherView = gs.getState(otherId).players.find((p) => p.playerId === elder.playerId);
  assert.equal(otherView.elderUsedLife, undefined, "andere sehen das Extra-Leben nicht");

  // Tag überspringen, Nacht 2: zweiter Angriff ist tödlich.
  gs.hostSkipPhase("host");
  gs.advanceFromResult("host");
  gs.submitNightAction("host", { targetId: elder.playerId });
  gs.advanceNightPhase("host");
  assert.equal(gs.findPlayer(elder.playerId).isAlive, false, "der zweite Angriff tötet den Ältesten");
});

test("Der Älteste ist nicht gegen den Gifttrank der Hexe gefeit", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({
      aelteste: { count: 1, enabled: true },
      hexe: { count: 1, enabled: true },
      dorfbewohner: { count: 1, enabled: true },
    }),
  });
  gs.startGame("host");
  const all = ["p0", "p1", "p2", "p3"].map((id) => gs.findPlayer(id));
  const elder = all.find((p) => p.role === "aelteste");
  const hexe = all.find((p) => p.role === "hexe");

  gs.advanceNightPhase("host"); // werwolf (kein Opfer) -> hexe
  gs.submitNightAction(hexe.playerId, { poisonId: elder.playerId });
  gs.advanceNightPhase("host");
  assert.equal(gs.findPlayer(elder.playerId).isAlive, false, "Gift wirkt trotz Extra-Leben");
});

test("Stichwahl-Gleichstand: enthält sich der Bürgermeister, scheidet niemand aus", () => {
  setupLobby(5, {
    mayorElectionEnabled: true,
    roles: FULL_ROLES({ dorfbewohner: { count: 4, enabled: true } }),
  });
  gs.startGame("host");
  gs.hostSetMayor("host", "p4"); // p4 wird Bürgermeister -> Nacht
  gs.advanceNightPhase("host"); // kein Nachtopfer -> Tag

  // Gleichstand p0 vs p1 erzwingen.
  gs.submitDayAccusation("p2", "p0");
  gs.submitDayAccusation("p3", "p1");
  gs.resolveDayPhase("host"); // -> voting
  gs.submitDayVote("p2", "p0");
  gs.submitDayVote("p3", "p1");
  gs.resolveDayPhase("host"); // erster Gleichstand -> Stichwahl
  gs.submitDayVote("p2", "p0");
  gs.submitDayVote("p3", "p1");
  // Der Bürgermeister stimmt für niemanden -> sein Doppelstimmrecht greift nicht.
  gs.submitDayVote("p4", null);
  const res = gs.resolveDayPhase("host");

  assert.equal(res.eliminatedId, null, "ohne Entscheidung des Bürgermeisters scheidet niemand aus");
  assert.equal(gs.findPlayer("p0").isAlive, true);
  assert.equal(gs.findPlayer("p1").isAlive, true);
  assert.equal(gs.getState(null).phase, "result");
});

test("Stichwahl-Gleichstand: Bürgermeister-Stimme entscheidet", () => {
  setupLobby(5, {
    mayorElectionEnabled: true,
    roles: FULL_ROLES({ dorfbewohner: { count: 4, enabled: true } }),
  });
  gs.startGame("host");
  gs.hostSetMayor("host", "p4");
  gs.advanceNightPhase("host");

  gs.submitDayAccusation("p2", "p0");
  gs.submitDayAccusation("p3", "p1");
  gs.resolveDayPhase("host");
  gs.submitDayVote("p2", "p0");
  gs.submitDayVote("p3", "p1");
  gs.resolveDayPhase("host"); // -> Stichwahl
  gs.submitDayVote("p2", "p0");
  gs.submitDayVote("p3", "p1");
  gs.submitDayVote("p4", "p1"); // Bürgermeister entscheidet für p1
  const res = gs.resolveDayPhase("host");

  assert.equal(res.eliminatedId, "p1", "die Bürgermeister-Stimme bricht den Gleichstand");
  assert.equal(gs.findPlayer("p1").isAlive, false);
});

test("adminSetRules begrenzt Werte und verwirft unbekannte Felder", () => {
  setupLobby(3);
  gs.adminSetRules("host", {
    maxPlayers: 999999,
    minPlayers: -10,
    voteDurationSeconds: 5,
    seherMode: "cheat_mode",
    unknownField: true,
    roles: {
      fakeRole: { count: 3, enabled: true },
      werwolf: { count: "1/3", enabled: true },
      seher: { count: 99, enabled: true },
    },
  });
  const rules = gs.getState(null).rules;
  assert.equal(rules.maxPlayers, 50, "maxPlayers ist hart gedeckelt");
  assert.equal(rules.minPlayers, 3, "minPlayers fällt nicht unter 3");
  assert.equal(rules.voteDurationSeconds, 30, "voteDurationSeconds hat eine Untergrenze");
  assert.equal(rules.seherMode, "good_evil", "ungültiger seherMode wird ignoriert");
  assert.equal(rules.unknownField, undefined, "unbekannte Felder werden verworfen");
  assert.equal(rules.roles.fakeRole, undefined, "unbekannte Rollen werden verworfen");
  assert.equal(rules.roles.werwolf.count, "1/3");
  assert.equal(rules.roles.seher.count, 50, "Rollenanzahl ist gedeckelt");
});

test("Bürgermeisterwahl nach Tages-Gleichstand schließt die Spielleitung aus", () => {
  setupLobby(4, {
    mayorElectionEnabled: true,
    roles: FULL_ROLES({ dorfbewohner: { count: 3, enabled: true } }),
  });
  gs.startGame("host");
  assert.equal(gs.getState(null).phase, "mayor_election");
  gs.hostSetMayor("host", null); // Wahl überspringen -> Nacht (kein Bürgermeister)
  gs.advanceNightPhase("host"); // -> Tag

  // Gleichstand p0 vs p1 erzwingen.
  gs.submitDayAccusation("p2", "p0");
  gs.submitDayAccusation("p3", "p1");
  gs.resolveDayPhase("host"); // -> voting
  gs.submitDayVote("p2", "p0");
  gs.submitDayVote("p3", "p1");
  gs.resolveDayPhase("host"); // erster Gleichstand -> Stichwahl
  gs.submitDayVote("p2", "p0");
  gs.submitDayVote("p3", "p1");
  const res = gs.resolveDayPhase("host"); // Stichwahl-Gleichstand, kein Bürgermeister

  assert.ok(res.needMayorElection, "Stichwahl-Gleichstand ohne Bürgermeister löst eine Wahl aus");
  assert.equal(gs.getState(null).phase, "mayor_election");
  const candidateIds = gs.getState(null).mayorElection.candidateIds;
  assert.equal(candidateIds.includes("host"), false, "die Spielleitung kandidiert nicht");
});
