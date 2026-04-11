import React from "react";
import { useGame } from "../context/GameContext";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Avatar } from "../components/Avatar";
import { t } from "../i18n/translations";

export function LobbyScreen({ lang, onOpenAdmin }) {
  const { state, me, emit, leave } = useGame();
  const players = state?.players ?? [];
  const rules = state?.rules ?? {};
  const connectedCount = players.filter((p) => p.isConnected && !p.isHost).length;
  const minPlayers = Number(rules.minPlayers) || 3;
  const roleIds = ["werwolf", "seher", "hexe", "dorfbewohner", "amor", "kopfgeldjaeger", "jaeger", "blinzelmaedchen", "baecker"];
  const totalRoles = roleIds.reduce((sum, roleId) => {
    const r = rules.roles?.[roleId];
    if (!r?.enabled) return sum;
    if (roleId === "werwolf" && r?.count === "1/3") return sum + Math.max(1, Math.floor(connectedCount / 3));
    return sum + (Number(r?.count) || 0);
  }, 0);
  const isHostOrAdmin = me?.isHost || me?.isAdmin;
  const canStart = isHostOrAdmin && connectedCount >= minPlayers && totalRoles <= connectedCount;
  const startDisabledReason =
    !isHostOrAdmin
      ? "startOnlyHost"
      : connectedCount < minPlayers
        ? "startNeedPlayers"
        : totalRoles > connectedCount
          ? "startRolesMismatch"
          : null;

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "transparent",
      }}
    >
      <header
        style={{
          background: "var(--md-sys-color-surface)",
          paddingLeft: "max(16px, var(--safe-left))",
          paddingRight: "max(16px, var(--safe-right))",
          paddingTop: "max(16px, var(--safe-top))",
          paddingBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar name={me?.name} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--md-sys-color-on-surface)", letterSpacing: "-0.02em" }}>
              {t(lang, "lobby")}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--md-sys-color-on-surface-variant)", marginTop: 2 }}>
              {t(lang, "waitingForStart")}
            </div>
          </div>
          {isHostOrAdmin && (
            <button
              type="button"
              className="md-state-layer"
              onClick={onOpenAdmin}
              style={{
                width: 48,
                height: 48,
                padding: 0,
                borderRadius: "50%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--md-sys-color-on-surface-variant)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label={t(lang, "gameSettings")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>settings</span>
            </button>
          )}
        </div>
      </header>

      <main
        style={{
          flex: 1,
          padding: "30px 20px",
          paddingLeft: "max(14px, var(--safe-left))",
          paddingRight: "max(30px, var(--safe-right))",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <Card variant="elevated" style={{ padding: 0, borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "var(--shadow-3)" }}>
          <div
            style={{
              padding: "16px 20px",
              background: "var(--md-sys-color-surface)",
              borderTopLeftRadius: "var(--radius-xl)",
              borderTopRightRadius: "var(--radius-xl)",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--md-sys-color-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t(lang, "players")} ({players.filter(p => !p.isHost).length})
            </span>
          </div>
          {players.map((p, i) => {
            const isMe = p.playerId === me?.playerId;
            const isLast = i === players.length - 1;
            return (
              <div
                key={p.playerId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: i % 2 === 0 ? "16px 20px" : "17px 20px",
                  background: isMe ? "var(--md-sys-color-secondary-container)" : "transparent",
                  boxShadow: isLast ? "none" : "inset 0 -1px 0 rgba(0, 0, 0, 0.05)",
                  borderBottomLeftRadius: isLast ? "var(--radius-xl)" : 0,
                  borderBottomRightRadius: isLast ? "var(--radius-xl)" : 0,
                }}
              >
                <Avatar name={p.name} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: 16, 
                    fontWeight: 600, 
                    color: isMe ? "var(--md-sys-color-on-secondary-container)" : "var(--md-sys-color-on-surface)",
                  }}>
                    {p.name}{" "}
                    {isMe && <span style={{ fontSize: 14, color: "var(--md-sys-color-primary)", fontWeight: 700 }}>({t(lang, "you")})</span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: isMe ? "var(--md-sys-color-on-secondary-container)" : "var(--md-sys-color-on-surface-variant)", marginTop: 2, opacity: 0.8 }}>
                    {p.isHost ? t(lang, "host") : t(lang, "connected")}
                  </div>
                </div>
                {p.isHost && (
                  <span
                    style={{
                      padding: "4px 10px",
                  borderRadius: "12px 18px 14px 20px",
                      fontSize: 12,
                      fontWeight: 600,
                      background: "var(--md-sys-color-primary)",
                      color: "var(--md-sys-color-on-primary)",
                    }}
                  >
                    {t(lang, "host")}
                  </span>
                )}
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: p.isConnected ? "var(--success)" : "var(--md-sys-color-error)",
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                  }}
                />
              </div>
            );
          })}
        </Card>
      </main>

      <footer
        style={{
          padding: "20px 16px",
          paddingBottom: "max(20px, var(--safe-bottom))",
          paddingLeft: "max(16px, var(--safe-left))",
          paddingRight: "max(16px, var(--safe-right))",
          background: "var(--md-sys-color-surface)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {isHostOrAdmin ? (
          <>
            <Button fullWidth disabled={!canStart} onClick={() => emit("start_game")} style={{ padding: "16px", fontSize: 16 }}>
              {t(lang, "startGame")}
            </Button>
            {startDisabledReason && (
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "var(--md-sys-color-error)",
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                {t(lang, startDisabledReason)}
              </p>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 15, color: "var(--md-sys-color-on-surface-variant)", textAlign: "center", fontWeight: 600 }}>
            {t(lang, "waitForHost")}
          </p>
        )}
        <Button variant="text" fullWidth onClick={leave} style={{ minHeight: 44, color: "var(--md-sys-color-error)", fontSize: 15 }}>
          {t(lang, "leaveRound")}
        </Button>
      </footer>
    </div>
  );
}
