import React, { useState } from "react";
import { useGame } from "../context/GameContext";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Avatar } from "../components/Avatar";
import { ConfirmModal } from "../components/ConfirmModal";
import { t } from "../i18n/translations";

export function DayScreen({ lang }) {
  const { state, me, emit, leave } = useGame();
  const [showEvaluateConfirm, setShowEvaluateConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const day = state?.day;
  const night = state?.night;
  const victimId = night?.victimId;
  const victim = victimId ? state?.players?.find((p) => p.playerId === victimId) : null;
  const alive = (state?.players ?? []).filter((p) => p.isAlive);
  const isAccusing = day?.status === "accusing";
  const accusations = day?.accusations ?? {};
  const myAccusation = me ? accusations[me.playerId] : undefined;
  const accusedIds = day?.accusedIds ?? [];
  const runoffCandidates = day?.runoffCandidates;
  const candidates = isAccusing
    ? alive.filter((p) => p.playerId !== me?.playerId && !p.isHost)
    : accusedIds.length > 0
      ? alive.filter((p) => accusedIds.includes(p.playerId))
      : runoffCandidates?.length
        ? alive.filter((p) => runoffCandidates.includes(p.playerId) && !p.isHost)
        : alive.filter((p) => p.playerId !== me?.playerId && !p.isHost);
  const votes = day?.votes ?? {};
  const myVote = me ? votes[me.playerId] : null;

  const voteCounts = {};
  candidates.forEach((p) => (voteCounts[p.playerId] = 0));
  Object.values(votes).forEach((id) => {
    if (id && voteCounts[id] !== undefined) voteCounts[id]++;
  });

  const iAmDead = me && !state?.players?.find((p) => p.playerId === me.playerId)?.isAlive;
  const iAmSilenced = day?.silencedPlayerId === me?.playerId;
  const voterCount = alive.filter((p) => !p.isHost && p.isAlive && p.playerId !== day?.silencedPlayerId).length;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--md-sys-color-background)" }}>
      <header
        style={{
          background: "var(--md-sys-color-surface)",
          paddingLeft: "max(16px, var(--safe-left))",
          paddingRight: "max(16px, var(--safe-right))",
          paddingTop: "max(16px, var(--safe-top))",
          paddingBottom: 16,
          borderBottom: "1px solid var(--md-sys-color-outline-variant)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: "50%", background: "rgba(217,119,6,0.1)", color: "#d97706" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28 }}>light_mode</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--md-sys-color-on-surface)", letterSpacing: "-0.02em" }}>
              {t(lang, "discussion")}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--md-sys-color-on-surface-variant)", marginTop: 2 }}>
              {t(lang, "round")} {state?.round ?? 1} · {t(lang, "day")}
            </div>
          </div>
        </div>
      </header>

      <div style={{ flex: 1, padding: "24px 16px", paddingLeft: "max(16px, var(--safe-left))", paddingRight: "max(16px, var(--safe-right))", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {victim && (
          <div
            style={{
              background: "var(--md-sys-color-error-container)",
              color: "var(--md-sys-color-on-error-container)",
              borderRadius: "var(--radius-lg)",
              padding: "20px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 32,
            }}
          >
            <div style={{ 
              width: 52, 
              height: 52, 
              borderRadius: "50%", 
              background: "var(--md-sys-color-error)",
              color: "var(--md-sys-color-on-error)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 28 }}>skull</span>
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
                {victim.name} {t(lang, "killedLastNight")}
              </p>
              <p style={{ fontSize: 14, fontWeight: 500, margin: "4px 0 0", opacity: 0.9 }}>{t(lang, "werewolvesStruck")}</p>
            </div>
          </div>
        )}

        {iAmSilenced && !iAmDead && (
          <div style={{ padding: "16px", marginBottom: 24, background: "var(--md-sys-color-surface-variant)", borderRadius: "var(--radius-lg)", color: "var(--md-sys-color-on-surface-variant)", fontWeight: 600 }}>
            Der Bäcker hat dir das Maul gestopft – du kannst diesmal nicht anklagen oder abstimmen.
          </div>
        )}

        {!iAmDead && isAccusing && (
          <Card variant="elevated" style={{ padding: 0, marginBottom: 32, borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--md-sys-color-outline-variant)", background: "var(--md-sys-color-surface-container)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "var(--md-sys-color-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Anklage · Wen klagst du an?
              </span>
              {me?.isHost && (
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--md-sys-color-primary)" }}>
                  {Object.keys(accusations).length} / {voterCount} Anklagen
                </span>
              )}
            </div>
            <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {candidates.map((p) => {
                const isMyAccusation = myAccusation === p.playerId;
                const canAccuse = !me?.isHost && !iAmSilenced;
                return (
                  <button
                    key={p.playerId}
                    type="button"
                    className={canAccuse ? "md-state-layer" : ""}
                    onClick={() => canAccuse && emit("day_accuse", { targetPlayerId: p.playerId })}
                    style={{
                      padding: "16px 12px",
                      borderRadius: "var(--radius-lg)",
                      border: `2px solid ${isMyAccusation ? "var(--md-sys-color-primary)" : "transparent"}`,
                      background: isMyAccusation ? "var(--md-sys-color-primary-container)" : "var(--md-sys-color-surface-container-low)",
                      color: "var(--md-sys-color-on-surface)",
                      textAlign: "center",
                      cursor: canAccuse ? "pointer" : "default",
                    }}
                  >
                    <Avatar name={p.name} size={52} style={{ margin: "0 auto 12px" }} />
                    <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{p.name}</p>
                    {isMyAccusation && <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--md-sys-color-primary)" }}>check_circle</span>}
                  </button>
                );
              })}
            </div>
            {!me?.isHost && !iAmSilenced && (
              <div style={{ padding: "0 16px 16px" }}>
                <Button variant="outlined" fullWidth onClick={() => emit("day_accuse", { targetPlayerId: null })} style={{ border: `2px solid ${myAccusation === null ? "var(--md-sys-color-primary)" : "var(--md-sys-color-outline-variant)"}` }}>
                  Niemanden anklagen
                </Button>
              </div>
            )}
          </Card>
        )}

        {!iAmDead && !isAccusing && day?.status !== "decided" && accusedIds.length > 0 && (
          <div style={{ marginBottom: 16, padding: "12px 16px", background: "var(--md-sys-color-secondary-container)", borderRadius: "var(--radius-lg)", color: "var(--md-sys-color-on-secondary-container)", fontSize: 14, fontWeight: 600 }}>
            Angeklagt: {alive.filter((p) => accusedIds.includes(p.playerId)).map((p) => p.name).join(", ")}
          </div>
        )}

        {!iAmDead && !isAccusing && (
          <Card variant="elevated" style={{ padding: 0, marginBottom: 32, borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--md-sys-color-outline-variant)", background: "var(--md-sys-color-surface-container)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "var(--md-sys-color-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {t(lang, "voting")} · {accusedIds.length > 0 ? "Abstimmung über Angeklagte" : t(lang, "voteWho")}
              </span>
              {day?.status !== "decided" && (
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--md-sys-color-primary)" }}>
                  {Object.keys(votes).length} / {voterCount} {t(lang, "votes")}
                </span>
              )}
            </div>
            {candidates.length === 0 && day?.status !== "decided" ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--md-sys-color-on-surface-variant)" }}>
                Niemand wurde angeklagt. Der Host kann auf „Weiter“ klicken.
              </div>
            ) : (
              <>
                <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {candidates.map((p) => {
                    const count = voteCounts[p.playerId] ?? 0;
                    const max = Math.max(...Object.values(voteCounts), 1);
                    const isMyVote = myVote === p.playerId;
                    const votingFinished = day?.status === "decided";
                    const canVote = !me?.isHost && !votingFinished && !iAmSilenced;
                    return (
                      <button
                        key={p.playerId}
                        type="button"
                        className={canVote ? "md-state-layer" : ""}
                        onClick={() => canVote && emit("day_vote", { targetPlayerId: p.playerId })}
                        style={{
                          padding: "16px 12px",
                          borderRadius: "var(--radius-lg)",
                          border: `2px solid ${isMyVote ? "var(--md-sys-color-primary)" : "transparent"}`,
                          background: isMyVote ? "var(--md-sys-color-primary-container)" : "var(--md-sys-color-surface-container-low)",
                          color: "var(--md-sys-color-on-surface)",
                          textAlign: "center",
                          cursor: canVote ? "pointer" : "default",
                          position: "relative",
                          opacity: votingFinished && !isMyVote && count === 0 ? 0.6 : 1,
                        }}
                      >
                        <Avatar name={p.name} size={52} style={{ margin: "0 auto 12px" }} />
                        <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>{p.name}</p>
                        {votingFinished && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ width: "100%", height: 6, background: "var(--md-sys-color-surface-variant)", borderRadius: 6, overflow: "hidden", marginBottom: 4 }}>
                              <div style={{ width: `${(count / max) * 100}%`, height: "100%", borderRadius: 6, background: "var(--md-sys-color-primary)" }} />
                            </div>
                            <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", margin: 0, fontWeight: 600 }}>{count} {t(lang, "votes")}</p>
                          </div>
                        )}
                        {isMyVote && <div style={{ position: "absolute", top: 10, right: 10, color: "var(--md-sys-color-primary)" }}><span className="material-symbols-outlined" style={{ fontSize: 24 }}>check_circle</span></div>}
                      </button>
                    );
                  })}
                </div>
                {!me?.isHost && day?.status !== "decided" && !iAmSilenced && candidates.length > 0 && (
                  <div style={{ padding: "0 16px 16px" }}>
                    <Button variant="outlined" fullWidth onClick={() => emit("day_vote", { targetPlayerId: null })} style={{ border: `2px solid ${myVote === null ? "var(--md-sys-color-primary)" : "var(--md-sys-color-outline-variant)"}` }}>
                      Niemanden wählen (Enthaltung)
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {runoffCandidates?.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: "16px", background: "var(--md-sys-color-secondary-container)", borderRadius: "var(--radius-lg)", color: "var(--md-sys-color-on-secondary-container)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>warning</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{t(lang, "runoff")}</span>
          </div>
        )}
      </div>

      {me?.isHost && (
        <footer style={{ 
          padding: "20px 16px",
          paddingBottom: "max(20px, var(--safe-bottom))",
          paddingLeft: "max(16px, var(--safe-left))",
          paddingRight: "max(16px, var(--safe-right))",
          background: "var(--md-sys-color-surface)",
          borderTop: "1px solid var(--md-sys-color-outline-variant)",
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}>
          {isAccusing && (
            <Card style={{ marginBottom: 12, padding: "16px", background: "var(--md-sys-color-surface-container)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: "var(--md-sys-color-on-surface)" }}>Anklage-Phase</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--md-sys-color-primary)" }}>{Object.keys(accusations).length} / {voterCount} Anklagen</span>
              </div>
            </Card>
          )}
          {!isAccusing && day?.status !== "decided" && (
            <Card style={{ marginBottom: 12, padding: "16px", background: "var(--md-sys-color-surface-container)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: "var(--md-sys-color-on-surface)" }}>Abstimmung läuft</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--md-sys-color-primary)" }}>{Object.keys(votes).length} / {voterCount} {t(lang, "votes")}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {candidates.map(p => {
                  const count = voteCounts[p.playerId] ?? 0;
                  if (count === 0) return null;
                  return (
                    <div key={p.playerId} style={{ background: "var(--md-sys-color-surface-variant)", padding: "4px 8px", borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{p.name}</span>
                      <span style={{ background: "var(--md-sys-color-primary)", color: "var(--md-sys-color-on-primary)", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          {!isAccusing && day?.status === "voting" && (
            <Button
              variant="filled"
              fullWidth
              onClick={() => emit("phase_next")}
              style={{ padding: "16px", fontSize: 16, fontWeight: 900, letterSpacing: "-0.01em", boxShadow: "var(--shadow-2)", marginBottom: 12 }}
            >
              Automatisch auswerten
            </Button>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button variant="tonal" onClick={() => setShowLeaveConfirm(true)} style={{ flex: 1, minWidth: 120, padding: "16px", fontSize: 16 }}>
              {t(lang, "leaveRound")}
            </Button>
            {day?.status === "voting" && (
              <Button variant="outlined" onClick={() => emit("host_skip_phase")} style={{ padding: "16px", fontSize: 16 }}>
                Abstimmung überspringen
              </Button>
            )}
            <Button
              style={{ flex: 1, minWidth: 120, padding: "16px", fontSize: 16 }}
              onClick={() => {
                if (isAccusing) {
                  emit("phase_next");
                  return;
                }
                const totalVotes = Object.keys(votes).length;
                if (totalVotes < voterCount && day?.status !== "decided") {
                  setShowEvaluateConfirm(true);
                } else {
                  emit("phase_next");
                }
              }}
            >
              {isAccusing ? "Weiter zur Abstimmung" : t(lang, "nextPhase")}
            </Button>
          </div>
        </footer>
      )}
      <ConfirmModal
        open={showLeaveConfirm}
        title={t(lang, "leaveRound")}
        message="Du bleibst angemeldet, wirst aber vom Spiel getrennt."
        confirmLabel={t(lang, "leaveRound")}
        cancelLabel="Abbrechen"
        onConfirm={() => { setShowLeaveConfirm(false); leave(); }}
        onCancel={() => setShowLeaveConfirm(false)}
      />
      <ConfirmModal
        open={showEvaluateConfirm}
        title="Abstimmung auswerten?"
        message="Es haben noch nicht alle Spieler abgestimmt. Wahl trotzdem jetzt auswerten?"
        confirmLabel="Auswerten"
        cancelLabel="Abbrechen"
        onConfirm={() => { setShowEvaluateConfirm(false); emit("phase_next"); }}
        onCancel={() => setShowEvaluateConfirm(false)}
      />
    </div>
  );
}
