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

test("Tagesstimmen werden nach der Auswertung abgelehnt", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ dorfbewohner: { count: 3, enabled: true } }),
  });
  gs.startGame("host");
  gs.advanceNightPhase("host"); // kein Nachtopfer -> Tag

  gs.submitDayAccusation("p1", "p0");
  gs.resolveDayPhase("host"); // accusing -> voting
  gs.submitDayVote("p1", "p0");
  gs.submitDayVote("p2", "p0");
  gs.resolveDayPhase("host"); // auswerten -> decided

  // Nach der Auswertung ist die Phase bereits "result" – jede weitere Stimme
  // muss abgelehnt werden (egal über welchen Guard).
  const late = gs.submitDayVote("p3", "p0");
  assert.equal(late.ok, false, "nach der Auswertung sind keine Stimmen mehr zulässig");
});

test("Admin darf niemanden auf einen vergebenen Namen umbenennen", () => {
  setupLobby(3);
  const res = gs.adminSetPlayerName("host", "p0", "P1");
  assert.equal(res.ok, false);
  assert.equal(res.error, "name_taken");
  assert.equal(gs.findPlayer("p0").name, "P0", "Name bleibt unverändert");
});

test("Dorfdepp überlebt die Abwahl, wird enttarnt und verliert sein Stimmrecht", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ dorfdepp: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const ids = ["p0", "p1", "p2", "p3"];
  const depp = ids.map((id) => gs.findPlayer(id)).find((p) => p.role === "dorfdepp");
  const voters = ids.map((id) => gs.findPlayer(id)).filter((p) => p.playerId !== depp.playerId);

  gs.advanceNightPhase("host"); // kein Nachtopfer -> Tag
  voters.forEach((v) => gs.submitDayAccusation(v.playerId, depp.playerId));
  gs.resolveDayPhase("host"); // accusing -> voting
  voters.forEach((v) => gs.submitDayVote(v.playerId, depp.playerId));
  const res = gs.resolveDayPhase("host");

  assert.ok(res.ok);
  assert.equal(res.eliminatedId, null, "der Dorfdepp scheidet nicht aus");
  assert.equal(gs.findPlayer(depp.playerId).isAlive, true, "der Dorfdepp lebt weiter");
  assert.equal(gs.findPlayer(depp.playerId).idiotRevealed, true, "der Dorfdepp ist enttarnt");

  // Seine Rolle ist jetzt öffentlich sichtbar.
  const otherView = gs.getState(voters[0].playerId).players.find((p) => p.playerId === depp.playerId);
  assert.equal(otherView.role, "dorfdepp", "Enttarnung ist öffentlich");
  assert.equal(otherView.idiotRevealed, true);

  // Nächster Tag: der Dorfdepp darf nicht mehr abstimmen.
  gs.advanceFromResult("host"); // -> Nacht
  gs.advanceNightPhase("host"); // -> Tag
  const accuse = gs.submitDayAccusation(voters[0].playerId, voters[1].playerId);
  assert.ok(accuse.ok);
  gs.resolveDayPhase("host"); // -> voting
  const deppVote = gs.submitDayVote(depp.playerId, voters[1].playerId);
  assert.equal(deppVote.ok, false);
  assert.equal(deppVote.error, "idiot_cannot_vote");
});

test("Zwillinge erkennen einander, andere sehen nichts", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ zwilling: { count: 2, enabled: true }, dorfbewohner: { count: 1, enabled: true } }),
  });
  gs.startGame("host");
  const ids = ["p0", "p1", "p2", "p3"];
  const twins = ids.map((id) => gs.findPlayer(id)).filter((p) => p.role === "zwilling");
  const villager = ids.map((id) => gs.findPlayer(id)).find((p) => p.role === "dorfbewohner");
  assert.equal(twins.length, 2);

  const twinView = gs.getState(twins[0].playerId).players.find((p) => p.playerId === twins[1].playerId);
  assert.equal(twinView.role, "zwilling", "Zwilling sieht die Rolle des anderen Zwillings");

  const villagerView = gs.getState(villager.playerId).players.find((p) => p.playerId === twins[0].playerId);
  assert.equal(villagerView.role, undefined, "andere sehen die Zwillings-Rolle nicht");
});

test("Jäger-Kette: trifft der Schuss einen weiteren Jäger, schießt auch dieser", () => {
  setupLobby(5, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({
      werwolf: { count: 1, enabled: true },
      jaeger: { count: 2, enabled: true },
      dorfbewohner: { count: 2, enabled: true },
    }),
  });
  gs.startGame("host");
  const ids = ["p0", "p1", "p2", "p3", "p4"];
  const all = ids.map((id) => gs.findPlayer(id));
  const wolf = all.find((p) => p.role === "werwolf");
  const [jaeger1, jaeger2] = all.filter((p) => p.role === "jaeger");

  // Werwolf reißt den ersten Jäger.
  gs.submitNightAction("host", { targetId: jaeger1.playerId });
  let r = gs.advanceNightPhase("host");
  assert.equal(r.phase, "jaeger_shot");

  // Jäger 1 erschießt Jäger 2 -> Jäger 2 darf ebenfalls schießen.
  r = gs.submitJaegerKill("host", jaeger2.playerId);
  assert.ok(r.ok);
  assert.equal(r.phase, "jaeger_shot", "der zweite Jäger reiht sich für den Schuss ein");
  assert.equal(gs.getState(null).jaegerSourceId, jaeger2.playerId);

  // Jäger 2 erschießt den Werwolf -> das Dorf gewinnt.
  r = gs.submitJaegerKill("host", wolf.playerId);
  assert.equal(r.winner, "village");
  assert.equal(gs.getState(null).winner, "village");
});

test("Beschützer darf bewusst niemanden schützen (passen)", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ beschuetzer: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const all = ["p0", "p1", "p2", "p3"].map((id) => gs.findPlayer(id));
  const beschuetzer = all.find((p) => p.role === "beschuetzer");

  assert.equal(gs.getState(null).night.subPhase, "beschuetzer");
  const res = gs.submitNightAction(beschuetzer.playerId, { targetId: null });
  assert.ok(res.ok);
  const view = gs.getState(beschuetzer.playerId).night.actions.beschuetzer;
  assert.equal(view.targetId, null);
});

test("Einladungs-Token existiert, ist nur für Mitspielende sichtbar und rotiert beim Reset", () => {
  setupLobby(3);
  const token = gs.getInviteToken();
  assert.ok(typeof token === "string" && token.length >= 16);

  const memberView = gs.getState("p0");
  assert.equal(memberView.inviteToken, token, "Mitspielende sehen das Token");
  const strangerView = gs.getState(null);
  assert.equal(strangerView.inviteToken, undefined, "Außenstehende sehen kein Token");

  gs.resetState();
  assert.notEqual(gs.getInviteToken(), token, "Reset erzeugt ein neues Token");
});

test("getPublicState enthält keine Spielerdaten", () => {
  setupLobby(3);
  const pub = gs.getPublicState();
  assert.equal(pub.players, undefined, "keine Spielerliste");
  assert.equal(pub.playersCount, 3, "nur die Anzahl (ohne Host)");
  assert.equal(pub.phase, "lobby");
  assert.equal(pub.gameLog, undefined);
});

test("Sündenbock stirbt beim Gleichstand anstelle einer Stichwahl", () => {
  setupLobby(5, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ suendenbock: { count: 1, enabled: true }, dorfbewohner: { count: 3, enabled: true } }),
  });
  gs.startGame("host");
  const ids = ["p0", "p1", "p2", "p3", "p4"];
  const goat = ids.map((id) => gs.findPlayer(id)).find((p) => p.role === "suendenbock");
  const others = ids.filter((id) => id !== goat.playerId);

  gs.advanceNightPhase("host"); // kein Nachtopfer -> Tag

  // Gleichstand zwischen zwei Nicht-Sündenböcken erzwingen.
  gs.submitDayAccusation(others[0], others[1]);
  gs.submitDayAccusation(others[1], others[2]);
  gs.resolveDayPhase("host"); // -> voting
  gs.submitDayVote(others[0], others[1]);
  gs.submitDayVote(others[1], others[2]);
  const res = gs.resolveDayPhase("host");

  assert.equal(res.scapegoat, true, "der Gleichstand trifft den Sündenbock");
  assert.equal(res.eliminatedId, goat.playerId);
  assert.equal(gs.findPlayer(goat.playerId).isAlive, false, "der Sündenbock ist tot");
  assert.equal(gs.findPlayer(others[1]).isAlive, true, "die Gleichstand-Kandidaten überleben");
  assert.equal(gs.findPlayer(others[2]).isAlive, true);
  assert.equal(gs.getState(null).phase, "result");
  assert.ok(
    gs.getState(null).gameLog.some((e) => e.messageKey === "scapegoat_death"),
    "der Sündenbock-Tod steht im Protokoll"
  );
});

test("Toter Sündenbock: Gleichstand führt wieder zur normalen Stichwahl", () => {
  setupLobby(5, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ suendenbock: { count: 1, enabled: true }, dorfbewohner: { count: 3, enabled: true } }),
  });
  gs.startGame("host");
  const ids = ["p0", "p1", "p2", "p3", "p4"];
  const goat = ids.map((id) => gs.findPlayer(id)).find((p) => p.role === "suendenbock");
  goat.isAlive = false; // Sündenbock ist bereits ausgeschieden
  const others = ids.filter((id) => id !== goat.playerId);

  gs.advanceNightPhase("host");
  gs.submitDayAccusation(others[0], others[1]);
  gs.submitDayAccusation(others[1], others[2]);
  gs.resolveDayPhase("host");
  gs.submitDayVote(others[0], others[1]);
  gs.submitDayVote(others[1], others[2]);
  const res = gs.resolveDayPhase("host");
  assert.equal(res.runoff, true, "ohne lebenden Sündenbock gibt es die Stichwahl");
});

test("Wildes Kind wählt ein Vorbild und wird bei dessen Tod zum Werwolf", () => {
  setupLobby(5, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ wildeskind: { count: 1, enabled: true }, dorfbewohner: { count: 3, enabled: true } }),
  });
  gs.startGame("host");
  const ids = ["p0", "p1", "p2", "p3", "p4"];
  const child = ids.map((id) => gs.findPlayer(id)).find((p) => p.role === "wildeskind");
  const model = ids.map((id) => gs.findPlayer(id)).find((p) => p.role === "dorfbewohner");

  // Erste Nacht beginnt mit der Vorbild-Wahl.
  assert.equal(gs.getState(null).night.subPhase, "wildeskind");
  gs.submitNightAction(child.playerId, { targetId: model.playerId });
  assert.equal(gs.findPlayer(child.playerId).roleModelId, model.playerId);

  // Nur das Kind selbst sieht sein Vorbild.
  const ownView = gs.getState(child.playerId).players.find((p) => p.playerId === child.playerId);
  assert.equal(ownView.roleModelId, model.playerId);
  const otherView = gs.getState(model.playerId).players.find((p) => p.playerId === child.playerId);
  assert.equal(otherView.roleModelId, undefined, "andere sehen das Vorbild nicht");

  // Werwölfe töten das Vorbild -> das Kind wechselt still die Seiten.
  gs.advanceNightPhase("host"); // wildeskind -> werwolf
  gs.submitNightAction("host", { targetId: model.playerId });
  gs.advanceNightPhase("host"); // Nacht auswerten
  const converted = gs.findPlayer(child.playerId);
  assert.equal(converted.role, "werwolf", "das Wilde Kind ist jetzt ein Werwolf");
  assert.equal(converted.wasWildChild, true);
});

test("Wildes Kind ohne Wahl bekommt am Nachtende ein zufälliges Vorbild", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ wildeskind: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const ids = ["p0", "p1", "p2", "p3"];
  const child = ids.map((id) => gs.findPlayer(id)).find((p) => p.role === "wildeskind");

  gs.advanceNightPhase("host"); // wildeskind -> werwolf (ohne Wahl)
  gs.advanceNightPhase("host"); // Nacht auswerten
  const after = gs.findPlayer(child.playerId);
  assert.ok(after.roleModelId, "das Vorbild wurde zugelost");
  assert.notEqual(after.roleModelId, child.playerId, "niemals das Kind selbst");
});

test("Wildes Kind zählt nach der Verwandlung für die Werwolf-Siegbedingung", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({
      werwolf: { count: 1, enabled: true },
      wildeskind: { count: 1, enabled: true },
      dorfbewohner: { count: 2, enabled: true },
    }),
  });
  gs.startGame("host");
  const ids = ["p0", "p1", "p2", "p3"];
  const all = ids.map((id) => gs.findPlayer(id));
  const child = all.find((p) => p.role === "wildeskind");
  const villager = all.find((p) => p.role === "dorfbewohner");

  // Kind nimmt einen Dorfbewohner als Vorbild; die Wölfe töten genau ihn.
  gs.submitNightAction(child.playerId, { targetId: villager.playerId });
  gs.advanceNightPhase("host"); // -> werwolf
  gs.submitNightAction("host", { targetId: villager.playerId });
  const res = gs.advanceNightPhase("host");

  // Nach der Verwandlung: 2 Werwölfe vs. 1 Dorfbewohner -> Werwölfe gewinnen.
  assert.equal(res.winner, "werwolf", "Verwandlung wird vor der Siegprüfung berücksichtigt");
});

test("Kopfgeldjäger erhält ein neues Ziel, wenn die Zielperson nachts stirbt", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ kopfgeldjaeger: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const ids = ["p0", "p1", "p2", "p3"];
  const hunter = ids.map((id) => gs.findPlayer(id)).find((p) => p.role === "kopfgeldjaeger");
  const oldTarget = hunter.bountyTargetId;
  assert.ok(oldTarget);

  // Werwölfe töten genau die Zielperson.
  gs.submitNightAction("host", { targetId: oldTarget });
  gs.advanceNightPhase("host");

  const after = gs.findPlayer(hunter.playerId);
  assert.notEqual(after.bountyTargetId, oldTarget, "das alte Ziel ist tot und wird ersetzt");
  assert.ok(after.bountyTargetId, "ein neues Ziel wurde ausgelost");
  assert.equal(gs.findPlayer(after.bountyTargetId).isAlive, true, "das neue Ziel lebt");
});

test("Jäger-Schuss kann übersprungen werden, ohne dass das Spiel hängen bleibt", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({
      werwolf: { count: 1, enabled: true },
      jaeger: { count: 1, enabled: true },
      dorfbewohner: { count: 2, enabled: true },
    }),
  });
  gs.startGame("host");
  const all = ["p0", "p1", "p2", "p3"].map((id) => gs.findPlayer(id));
  const jaeger = all.find((p) => p.role === "jaeger");

  // Werwolf tötet den Jäger -> jaeger_shot.
  gs.submitNightAction("host", { targetId: jaeger.playerId });
  const r = gs.advanceNightPhase("host");
  assert.equal(r.phase, "jaeger_shot");

  // Der Host überspringt den Schuss -> es geht regulär in den Tag.
  const skip = gs.hostSkipPhase("host");
  assert.ok(skip.ok);
  assert.equal(skip.phase, "day");
  assert.equal(gs.getState(null).phase, "day");
  assert.equal(gs.getState(null).jaegerSourceId, null);
});

test("Statistik zählt Partien und Siege und überlebt Resets", () => {
  setupLobby(3, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ werwolf: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  const before = gs.getStats();
  gs.startGame("host");
  const villager = ["p0", "p1", "p2"].map((id) => gs.findPlayer(id)).find((p) => p.role === "dorfbewohner");
  gs.submitNightAction("host", { targetId: villager.playerId });
  gs.advanceNightPhase("host"); // Werwolf erreicht Gleichzahl -> game_end

  const after = gs.getStats();
  assert.equal(after.gamesPlayed, before.gamesPlayed + 1, "die Partie wurde gezählt");
  assert.equal(after.wins.werwolf, before.wins.werwolf + 1, "der Werwolf-Sieg wurde gezählt");

  // Reset in die Lobby ändert die Statistik nicht.
  gs.restartToLobby("host");
  assert.deepEqual(gs.getStats(), after, "Reset löscht die Statistik nicht");

  // Statistik ist im State für Mitspielende sichtbar.
  const view = gs.getState("p0");
  assert.equal(view.stats.gamesPlayed, after.gamesPlayed);
});

test("Neue Runde entfernt Geister (getrennte Verbindungen) aus der Lobby", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ dorfbewohner: { count: 3, enabled: true } }),
  });
  gs.startGame("host");
  // p3 verlässt die Partie endgültig.
  gs.setPlayerDisconnected("p3");
  gs.endGameNow("village");
  gs.restartToLobby("host");

  const s = gs.getState(null);
  assert.equal(s.phase, "lobby");
  assert.equal(s.players.some((p) => p.playerId === "p3"), false, "der Geist ist entfernt");
  assert.equal(s.players.some((p) => p.playerId === "p0"), true, "verbundene Spieler bleiben");
});

test("Enttarnter Dorfdepp darf bei der Bürgermeisterwahl nicht abstimmen", () => {
  setupLobby(4, {
    mayorElectionEnabled: true,
    roles: FULL_ROLES({ dorfdepp: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const ids = ["p0", "p1", "p2", "p3"];
  const depp = ids.map((id) => gs.findPlayer(id)).find((p) => p.role === "dorfdepp");
  // Enttarnung simulieren.
  depp.idiotRevealed = true;
  const res = gs.submitMayorVote(depp.playerId, ids.find((id) => id !== depp.playerId));
  assert.equal(res.ok, false);
  assert.equal(res.error, "idiot_cannot_vote");
});

test("Seher darf pro Nacht nur eine Person prüfen", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ seher: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const all = ["p0", "p1", "p2", "p3"].map((id) => gs.findPlayer(id));
  const seher = all.find((p) => p.role === "seher");
  const [v1, v2] = all.filter((p) => p.role === "dorfbewohner");

  gs.advanceNightPhase("host"); // werwolf -> seher
  const first = gs.submitNightAction(seher.playerId, { targetId: v1.playerId });
  assert.ok(first.ok);
  const second = gs.submitNightAction(seher.playerId, { targetId: v2.playerId });
  assert.equal(second.ok, false);
  assert.equal(second.error, "already_inspected");
  assert.equal(gs.getState("host").night.actions.seher.targetId, v1.playerId, "erste Wahl bleibt bestehen");
});

test("Enttarnter Dorfdepp darf tagsüber nicht anklagen", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ dorfdepp: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const ids = ["p0", "p1", "p2", "p3"];
  const depp = ids.map((id) => gs.findPlayer(id)).find((p) => p.role === "dorfdepp");
  depp.idiotRevealed = true;

  gs.advanceNightPhase("host"); // Nacht ohne Opfer -> Tag
  assert.equal(gs.getState(null).phase, "day");
  const res = gs.submitDayAccusation(depp.playerId, ids.find((id) => id !== depp.playerId));
  assert.equal(res.ok, false);
  assert.equal(res.error, "idiot_cannot_vote");
});

test("Hexen-Trank-Status ist für Mitspieler maskiert, für Hexe und Host sichtbar", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ hexe: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const all = ["p0", "p1", "p2", "p3"].map((id) => gs.findPlayer(id));
  const hexe = all.find((p) => p.role === "hexe");
  const villager = all.find((p) => p.role === "dorfbewohner");

  assert.equal(gs.getState(villager.playerId).witchUsedHeal, null, "Dorfbewohner sieht Trank-Status nicht");
  assert.equal(gs.getState(villager.playerId).witchUsedPoison, null);
  assert.equal(gs.getState(hexe.playerId).witchUsedHeal, false, "Hexe sieht ihren eigenen Status");
  assert.equal(gs.getState("host").witchUsedHeal, false, "Host sieht den Status");
});

test("Hexe sieht das Werwolf-Opfer erst in ihrer eigenen Subphase", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ hexe: { count: 1, enabled: true }, dorfbewohner: { count: 2, enabled: true } }),
  });
  gs.startGame("host");
  const all = ["p0", "p1", "p2", "p3"].map((id) => gs.findPlayer(id));
  const hexe = all.find((p) => p.role === "hexe");
  const villager = all.find((p) => p.role === "dorfbewohner");

  // Werwolf-Subphase: Host trägt das Opfer ein – Hexe darf es noch nicht sehen.
  gs.submitNightAction("host", { targetId: villager.playerId });
  assert.equal(gs.getState(hexe.playerId).night.actions.werwolf.targetId, null, "vor ihrer Phase maskiert");

  gs.advanceNightPhase("host"); // werwolf -> hexe
  assert.equal(gs.getState(null).night.subPhase, "hexe");
  assert.equal(gs.getState(hexe.playerId).night.actions.werwolf.targetId, villager.playerId, "in ihrer Phase sichtbar");
});

test("adminSetRules: minPlayers kann maxPlayers nicht übersteigen", () => {
  setupLobby(3);
  gs.adminSetRules("host", { maxPlayers: 5 });
  gs.adminSetRules("host", { minPlayers: 10 });
  const rules = gs.getState(null).rules;
  assert.ok(rules.maxPlayers >= rules.minPlayers, "max wird auf min angehoben");
});

test("Stichwahl startet die Bedenkzeit neu", () => {
  setupLobby(4, {
    mayorElectionEnabled: false,
    roles: FULL_ROLES({ dorfbewohner: { count: 3, enabled: true } }),
  });
  gs.startGame("host");
  const ids = ["p0", "p1", "p2", "p3"];
  gs.advanceNightPhase("host"); // Nacht ohne Opfer -> Tag

  // Zwei Lager klagen zwei verschiedene Personen an -> Gleichstand in der Abstimmung.
  gs.submitDayAccusation("p0", "p2");
  gs.submitDayAccusation("p1", "p3");
  gs.resolveDayPhase("host"); // accusing -> voting
  const firstStart = gs.getState(null).day.votingStartedAt;
  gs.submitDayVote("p0", "p2");
  gs.submitDayVote("p1", "p3");
  const res = gs.resolveDayPhase("host");
  assert.ok(res.runoff, "Gleichstand führt zur Stichwahl");
  const secondStart = gs.getState(null).day.votingStartedAt;
  assert.ok(secondStart, "Stichwahl hat einen Startzeitpunkt");
  assert.ok(new Date(secondStart) >= new Date(firstStart), "Timer wurde neu gesetzt");
});
