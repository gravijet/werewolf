/**
 * Spieler-Daten speichern (localStorage + Cookies), damit nach Reload
 * sofort mit gespeichertem Namen (und Reconnect) eingeloggt wird.
 * localStorage ist primär (zuverlässiger bei SPAs), Cookies als Fallback.
 */

const STORAGE_KEY = "werwolf_player";
const KEY_PLAYER_ID = "werwolf_playerId";
const KEY_PLAYER_NAME = "werwolf_playerName";
const KEY_PASSWORD = "werwolf_password";
const KEY_CAN_CHANGE_NAME = "werwolf_canChangeName";
const KEY_RECONNECT_TOKEN = "werwolf_reconnectToken";

function getCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
  const value = match ? decodeURIComponent(match[1]) : null;
  return value === "" ? null : value;
}

function setCookie(name, value) {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location?.protocol === "https:" ? "; Secure" : "";
  const v = value == null ? "" : String(value);
  document.cookie = name + "=" + encodeURIComponent(v) + "; path=/; max-age=31536000; SameSite=Lax" + secure;
}

function removeCookie(name) {
  if (typeof document === "undefined") return;
  document.cookie = name + "=; path=/; max-age=0";
}

function readFromStorage() {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data === "object") {
          return {
            playerId: data.playerId || null,
            playerName: data.playerName || null,
            password: data.password || null,
            canChangeName: data.canChangeName === true,
            reconnectToken: data.reconnectToken || null,
          };
        }
      }
    }
  } catch {}
  return null;
}

function writeToStorage(data) {
  try {
    if (typeof localStorage !== "undefined" && data) {
      const toSave = {};
      if (data.playerId != null) toSave.playerId = data.playerId;
      if (data.playerName != null) toSave.playerName = data.playerName;
      if (data.password != null) toSave.password = data.password;
      if (data.canChangeName != null) toSave.canChangeName = data.canChangeName;
      if (data.reconnectToken != null) toSave.reconnectToken = data.reconnectToken;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    }
  } catch {}
}

export function getStoredPlayer() {
  try {
    let data = readFromStorage() || {};
    return {
      playerId: data.playerId || getCookie(KEY_PLAYER_ID) || null,
      playerName: data.playerName || getCookie(KEY_PLAYER_NAME) || null,
      password: data.password || getCookie(KEY_PASSWORD) || null,
      canChangeName: data.canChangeName !== undefined ? data.canChangeName : getCookie(KEY_CAN_CHANGE_NAME) === "true",
      reconnectToken: data.reconnectToken || getCookie(KEY_RECONNECT_TOKEN) || null,
    };
  } catch {
    return { playerId: null, playerName: null, password: null, canChangeName: true, reconnectToken: null };
  }
}

export function setStoredPlayer(updates) {
  try {
    const current = getStoredPlayer();
    const merged = {
      playerId: updates.playerId !== undefined ? updates.playerId : current.playerId,
      playerName: updates.playerName !== undefined ? updates.playerName : current.playerName,
      password: updates.password !== undefined ? updates.password : current.password,
      canChangeName: updates.canChangeName !== undefined ? updates.canChangeName : current.canChangeName,
      reconnectToken: updates.reconnectToken !== undefined ? updates.reconnectToken : current.reconnectToken,
    };
    writeToStorage(merged);
    if (merged.playerId != null) setCookie(KEY_PLAYER_ID, merged.playerId);
    else removeCookie(KEY_PLAYER_ID);
    if (merged.playerName != null) setCookie(KEY_PLAYER_NAME, merged.playerName);
    else removeCookie(KEY_PLAYER_NAME);
    if (merged.password != null) setCookie(KEY_PASSWORD, merged.password);
    else removeCookie(KEY_PASSWORD);
    if (merged.canChangeName != null) setCookie(KEY_CAN_CHANGE_NAME, merged.canChangeName ? "true" : "false");
    if (merged.reconnectToken != null) setCookie(KEY_RECONNECT_TOKEN, merged.reconnectToken);
    else removeCookie(KEY_RECONNECT_TOKEN);
  } catch {}
}

export function clearStoredPlayer() {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
    removeCookie(KEY_PLAYER_ID);
    removeCookie(KEY_PLAYER_NAME);
    removeCookie(KEY_PASSWORD);
    removeCookie(KEY_CAN_CHANGE_NAME);
    removeCookie(KEY_RECONNECT_TOKEN);
  } catch {}
}

export function clearStoredCredentials() {
  try {
    const current = getStoredPlayer();
    setStoredPlayer({
      ...current,
      playerId: null,
      password: null,
      reconnectToken: null,
    });
  } catch {}
}

const KEY_LAST_JOIN_ERROR = "werwolf_lastJoinError";
const JOIN_ERROR_COOKIE_MAX_AGE = 86400; // 1 Tag (in Sekunden)

/** Nach Kick/Bann in Cookie speichern, damit nach Reload „Du wurdest gekickt/gebannt“ angezeigt wird. */
export function setLastJoinError(code, message) {
  try {
    if (typeof document === "undefined") return;
    const value = JSON.stringify({ code, message });
    const secure = typeof window !== "undefined" && window.location?.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      KEY_LAST_JOIN_ERROR + "=" + encodeURIComponent(value) + "; path=/; max-age=" + JOIN_ERROR_COOKIE_MAX_AGE + "; SameSite=Lax" + secure;
  } catch {}
}

/** Nur lesen, ob eine Kick/Bann-Meldung gespeichert ist (ohne Cookie zu löschen). */
export function getLastJoinError() {
  try {
    if (typeof document === "undefined") return null;
    const raw = getCookie(KEY_LAST_JOIN_ERROR);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.code ? { code: data.code, message: data.message || data.code } : null;
  } catch {
    return null;
  }
}

/** Beim Anzeigen der Join-Maske: gespeicherte Kick/Bann-Meldung lesen und Cookie entfernen. */
export function consumeLastJoinError() {
  try {
    const data = getLastJoinError();
    if (!data) return null;
    removeCookie(KEY_LAST_JOIN_ERROR);
    return data.message || data.code;
  } catch {
    return null;
  }
}
