import React, { useState } from "react";
import { useGame } from "../context/GameContext";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Avatar } from "../components/Avatar";
import { QrModal } from "../components/QrModal";
import { usePwaInstall } from "../lib/usePwaInstall";
import { t } from "../i18n/translations";

export function LobbyScreen({ lang, onOpenAdmin }) {
  const { state, me, emit, leave } = useGame();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const { canInstall, promptInstall } = usePwaInstall();
  const players = state?.players ?? [];
  const rules = state?.rules ?? {};
  const connectedCount = players.filter((p) => p.isConnected && !p.isHost).length;
  const minPlayers = Number(rules.minPlayers) || 3;
  const roleIds = ["werwolf", "seher", "hexe", "dorfbewohner", "amor", "kopfgeldjaeger", "jaeger", "blinzelmaedchen", "baecker", "beschuetzer"];
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

  // Direkter Beitritts-Link ohne Passwort: Gäste müssen nur ihren Namen eingeben.
  const inviteUrl =
    typeof window !== "undefined" ? window.location.origin + "/nopassword" : "";

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = inviteUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {}
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: t(lang, "appTitle"), text: t(lang, "shareInvite"), url: inviteUrl });
        return;
      } catch {
        /* Nutzer hat abgebrochen → trotzdem kopieren */
      }
    }
    doCopy();
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "transparent" }}>
      <header
        style={{
          padding: "calc(var(--safe-top) + 16px) max(16px, var(--safe-right)) 16px max(16px, var(--safe-left))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar name={me?.name} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="gradient-text" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
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
                border: "1px solid var(--hairline)",
                background: "var(--md-sys-color-surface)",
                boxShadow: "var(--shadow-1)",
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
          width: "min(640px, 100%)",
          margin: "0 auto",
          padding: "12px 20px 30px",
          paddingLeft: "max(16px, var(--safe-left))",
          paddingRight: "max(16px, var(--safe-right))",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Einladen / Link teilen */}
        <Card
          className="slide-up"
          style={{
            padding: "18px 20px",
            marginBottom: 20,
            background: "var(--hero-gradient)",
            color: "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 30 }}>group_add</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{t(lang, "invite")}</div>
              <div style={{ fontSize: 13, opacity: 0.92, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t(lang, "shareInvite")}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                className="md-state-layer"
                onClick={() => setShowQr(true)}
                aria-label={t(lang, "scanToJoin")}
                title={t(lang, "scanToJoin")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  border: "none",
                  background: "rgba(255,255,255,0.22)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>qr_code_2</span>
              </button>
              <button
                type="button"
                className="md-state-layer"
                onClick={handleInvite}
                aria-label={t(lang, copied ? "linkCopied" : "copyLink")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 16px",
                  borderRadius: 999,
                  border: "none",
                  background: "rgba(255,255,255,0.22)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {copied ? "check" : "share"}
                </span>
                {copied ? t(lang, "linkCopied") : t(lang, "invite")}
              </button>
            </div>
          </div>
        </Card>

        <Card variant="elevated" style={{ padding: 0, borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "var(--shadow-2)" }}>
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {t(lang, "players")}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                padding: "3px 12px",
                borderRadius: 999,
                background: connectedCount >= minPlayers ? "var(--success-bg)" : "var(--md-sys-color-surface-variant)",
                color: connectedCount >= minPlayers ? "var(--success)" : "var(--md-sys-color-on-surface-variant)",
              }}
            >
              {connectedCount} / {minPlayers}+
            </span>
          </div>
          <div className="stagger">
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
                    padding: "14px 20px",
                    background: isMe ? "var(--md-sys-color-primary-container)" : "transparent",
                    borderBottom: isLast ? "none" : "1px solid var(--hairline)",
                  }}
                >
                  <Avatar name={p.name} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: isMe ? "var(--md-sys-color-on-primary-container)" : "var(--md-sys-color-on-surface)",
                    }}>
                      {p.name}{" "}
                      {isMe && <span style={{ fontSize: 14, color: "var(--md-sys-color-primary)", fontWeight: 700 }}>({t(lang, "you")})</span>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: isMe ? "var(--md-sys-color-on-primary-container)" : "var(--md-sys-color-on-surface-variant)", marginTop: 2, opacity: 0.85 }}>
                      {p.isHost ? t(lang, "host") : t(lang, "connected")}
                    </div>
                  </div>
                  {p.isHost && (
                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        background: "var(--md-sys-color-primary)",
                        color: "var(--md-sys-color-on-primary)",
                      }}
                    >
                      {t(lang, "host")}
                    </span>
                  )}
                  <span
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: p.isConnected ? "var(--success)" : "var(--md-sys-color-error)",
                      boxShadow: p.isConnected ? "0 0 0 3px var(--success-bg)" : "none",
                      flexShrink: 0,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      </main>

      <footer
        style={{
          width: "min(640px, 100%)",
          margin: "0 auto",
          padding: "20px 16px",
          paddingBottom: "max(20px, var(--safe-bottom))",
          paddingLeft: "max(16px, var(--safe-left))",
          paddingRight: "max(16px, var(--safe-right))",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {isHostOrAdmin ? (
          <>
            <Button fullWidth disabled={!canStart} onClick={() => emit("start_game")} style={{ padding: "16px", fontSize: 16 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>play_arrow</span>
              {t(lang, "startGame")}
            </Button>
            {startDisabledReason && (
              <p style={{ margin: 0, fontSize: 14, color: "var(--md-sys-color-error)", textAlign: "center", fontWeight: 600 }}>
                {t(lang, startDisabledReason)}
              </p>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 15, color: "var(--md-sys-color-on-surface-variant)", textAlign: "center", fontWeight: 600 }}>
            {t(lang, "waitForHost")}
          </p>
        )}
        {canInstall && (
          <Button variant="text" fullWidth onClick={promptInstall} style={{ minHeight: 44, fontSize: 15 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>install_mobile</span>
            {t(lang, "installApp")}
          </Button>
        )}
        <Button variant="text" fullWidth onClick={leave} style={{ minHeight: 44, color: "var(--md-sys-color-error)", fontSize: 15 }}>
          {t(lang, "leaveRound")}
        </Button>
      </footer>

      <QrModal open={showQr} url={inviteUrl} lang={lang} onClose={() => setShowQr(false)} />
    </div>
  );
}
