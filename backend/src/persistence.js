/**
 * Persistiert Spielzustand und Bans in eine JSON-Datei.
 * Beim Start wird geladen, nach Änderungen gespeichert (debounced).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.WERWOLF_DATA_DIR || join(__dirname, "..", "data");
const STATE_FILE = join(DATA_DIR, "state.json");

let saveTimeout = null;
const DEBOUNCE_MS = 2000;

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Lädt State und Bans aus der Datei. Gibt null zurück wenn keine Datei oder Fehler.
 */
export function load() {
  try {
    ensureDir();
    if (!existsSync(STATE_FILE)) return null;
    const raw = readFileSync(STATE_FILE, "utf8");
    const data = JSON.parse(raw);
    return data;
  } catch (e) {
    console.warn("Persistence load:", e.message);
    return null;
  }
}

/**
 * Speichert State und Bans (Debounce). Akzeptiert den Snapshot direkt oder als
 * Factory-Funktion – Letztere wird erst beim tatsächlichen Schreiben aufgerufen,
 * damit nicht bei jeder State-Mutation ein Snapshot gebaut wird.
 * @param {object|Function} snapshot
 */
export function save(snapshot) {
  if (!snapshot) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    try {
      ensureDir();
      const data = typeof snapshot === "function" ? snapshot() : snapshot;
      writeFileSync(STATE_FILE, JSON.stringify(data, null, 0), "utf8");
    } catch (e) {
      console.warn("Persistence save:", e.message);
    }
  }, DEBOUNCE_MS);
}

export function saveSync(snapshot) {
  if (!snapshot) return;
  try {
    ensureDir();
    writeFileSync(STATE_FILE, JSON.stringify(snapshot, null, 0), "utf8");
  } catch (e) {
    console.warn("Persistence saveSync:", e.message);
  }
}
