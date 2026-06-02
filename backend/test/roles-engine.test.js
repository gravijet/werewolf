import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveCount,
  totalConfiguredRoles,
  distributeRoles,
  getRoleMeta,
} from "../src/roles-engine.js";

const baseRules = (overrides = {}) => ({
  roles: {
    werwolf: { count: "1/3", enabled: true },
    seher: { count: 1, enabled: true },
    hexe: { count: 1, enabled: true },
    dorfbewohner: { count: 0, enabled: false },
    amor: { count: 0, enabled: false },
    kopfgeldjaeger: { count: 0, enabled: false },
    jaeger: { count: 0, enabled: false },
    blinzelmaedchen: { count: 0, enabled: false },
    baecker: { count: 0, enabled: false },
    ...overrides,
  },
});

const countRoles = (arr) =>
  arr.reduce((acc, r) => ((acc[r] = (acc[r] || 0) + 1), acc), {});

test("resolveCount: 1/3 ergibt mindestens 1", () => {
  assert.equal(resolveCount({ count: "1/3", enabled: true }, 3), 1);
  assert.equal(resolveCount({ count: "1/3", enabled: true }, 9), 3);
  assert.equal(resolveCount({ count: "1/3", enabled: true }, 2), 1);
});

test("resolveCount: deaktivierte Rolle ergibt 0", () => {
  assert.equal(resolveCount({ count: 5, enabled: false }, 10), 0);
  assert.equal(resolveCount(undefined, 10), 0);
});

test("resolveCount: feste Zahl wird übernommen (und gefloort)", () => {
  assert.equal(resolveCount({ count: 2, enabled: true }, 10), 2);
  assert.equal(resolveCount({ count: 2.9, enabled: true }, 10), 2);
});

test("distributeRoles: liefert immer genau playerCount Rollen", () => {
  for (const n of [3, 4, 6, 8, 12, 20]) {
    const roles = distributeRoles(baseRules(), n);
    assert.equal(roles.length, n);
  }
});

test("distributeRoles: füllt Rest mit Dorfbewohnern", () => {
  const roles = distributeRoles(baseRules(), 8);
  const counts = countRoles(roles);
  // 8 Spieler: 2 Werwölfe (1/3 → floor(8/3)=2), 1 Seher, 1 Hexe → 4 Dorfbewohner Rest.
  assert.equal(counts.werwolf, 2);
  assert.equal(counts.seher, 1);
  assert.equal(counts.hexe, 1);
  assert.equal(counts.dorfbewohner, 4);
});

test("distributeRoles: Überlauf entfernt zuerst Dorfbewohner, behält Spezialrollen", () => {
  const rules = baseRules({
    werwolf: { count: 1, enabled: true },
    seher: { count: 1, enabled: true },
    hexe: { count: 1, enabled: true },
    jaeger: { count: 1, enabled: true },
    amor: { count: 1, enabled: true },
    dorfbewohner: { count: 5, enabled: true },
  });
  // Konfiguriert: 1+1+1+1+1+5 = 10 Rollen, aber nur 6 Spieler → 4 müssen weg.
  const roles = distributeRoles(rules, 6);
  const counts = countRoles(roles);
  assert.equal(roles.length, 6);
  // Spezialrollen bleiben erhalten.
  assert.equal(counts.werwolf, 1);
  assert.equal(counts.seher, 1);
  assert.equal(counts.hexe, 1);
  assert.equal(counts.jaeger, 1);
  assert.equal(counts.amor, 1);
  // Nur Dorfbewohner wurden abgebaut (5 → 1).
  assert.equal(counts.dorfbewohner ?? 0, 1);
});

test("distributeRoles: behält mindestens einen Werwolf wenn nötig", () => {
  const roles = distributeRoles(baseRules(), 3);
  const counts = countRoles(roles);
  assert.ok(counts.werwolf >= 1);
});

test("totalConfiguredRoles: summiert konfigurierte Rollen korrekt", () => {
  assert.equal(totalConfiguredRoles(baseRules(), 9), 3 + 1 + 1); // 3 Werwölfe + Seher + Hexe
});

test("getRoleMeta: Kopfgeldjäger ist Solo-Team", () => {
  const meta = getRoleMeta();
  assert.equal(meta.kopfgeldjaeger.team, "solo");
  assert.equal(meta.werwolf.team, "werwolf");
  assert.equal(meta.seher.team, "village");
});
