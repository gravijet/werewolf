import React, { useMemo } from "react";
import { useGame } from "../context/GameContext";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Avatar } from "../components/Avatar";
import { PhaseBar } from "../components/PhaseBar";
import { ConfirmModal } from "../components/ConfirmModal";
import { t } from "../i18n/translations";

export function MayorScreen({ lang }) {
  const { state, me, emit, leave } = useGame();
  const election = state?.mayorElection;
  const players = state?.players ?? [];
  const candidates = election?.candidateIds
    ? players.filter((p) => election.candidateIds.includes(p.playerId) && !p.isHost)
    : players.filter((p) => !p.isHost);
  const votes = election?.votes ?? {};
  const myVote = me ? votes[me.playerId] : null;

  const voteCounts = useMemo(() => {
    const c = {};
    candidates.forEach((p) => (c[p.playerId] = 0));
    Object.values(votes).forEach((targetId) => {
      if (targetId && c[targetId] !== undefined) c[targetId]++;
    });
    return c;
  }, [candidates, votes]);

  const totalVotes = Object.keys(votes).length;
  const voterCount = players.filter((p) => !p.isHost && p.isAlive && p.isConnected).length;
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = React.useState(false);

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
          textAlign: "center",
        }}
      >
        <PhaseBar currentPhase="mayor_election" lang={lang} />
        <hr style={{ border: "none", height: 1, background: "var(--md-sys-color-outline-variant)", margin: "24px -20px 32px" }} />
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: "50%", background: "var(--md-sys-color-secondary-container)", color: "var(--md-sys-color-on-secondary-container)", marginBottom: 20 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40 }}>military_tech</span>
          </div>
          <p style={{ fontSize: 28, fontWeight: 800, color: "var(--md-sys-color-on-surface)", margin: 0, letterSpacing: "-0.02em" }}>{t(lang, "mayorElection")}</p>
        </div>
      </header>

      <div style={{ flex: 1, padding: "24px 16px", paddingLeft: "max(16px, var(--safe-left))", paddingRight: "max(16px, var(--safe-right))", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <Card variant="elevated" style={{ padding: 0, borderRadius: "var(--radius-xl)", overflow: "hidden", marginBottom: 32 }}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--md-sys-color-outline-variant)",
              background: "var(--md-sys-color-surface-container)",
              borderTopLeftRadius: "var(--radius-xl)",
              borderTopRightRadius: "var(--radius-xl)",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--md-sys-color-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t(lang, "votes")} · {candidates.length} {t(lang, "players")}
            </span>
          </div>
          {candidates.map((p, i) => {
            const count = voteCounts[p.playerId] ?? 0;
            const max = Math.max(...Object.values(voteCounts), 1);
            const isVoted = myVote === p.playerId;
            const hasVoted = myVote !== undefined && myVote !== null && election?.status !== "tie_redo";
            const votingFinished = election?.status === "decided";
            const canVote = !me?.isHost && !votingFinished && !hasVoted && election?.candidateIds?.includes(p.playerId);
            const isLast = i === candidates.length - 1;
            
            return (
              <div
                key={p.playerId}
                role="button"
                tabIndex={canVote ? 0 : -1}
                className={canVote ? "md-state-layer" : ""}
                onClick={() => canVote && emit("mayor_vote", { targetPlayerId: p.playerId })}
                onKeyDown={(e) => e.key === "Enter" && canVote && emit("mayor_vote", { targetPlayerId: p.playerId })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 20px",
                  cursor: canVote ? "pointer" : "default",
                  border: `2px solid ${isVoted ? "var(--md-sys-color-primary)" : "transparent"}`,
                  background: isVoted ? "var(--md-sys-color-primary-container)" : "var(--md-sys-color-surface-container-low)",
                  borderBottom: isLast ? "none" : "1px solid var(--md-sys-color-outline-variant)",
                  borderBottomLeftRadius: isLast ? "var(--radius-xl)" : 0,
                  borderBottomRightRadius: isLast ? "var(--radius-xl)" : 0,
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: isVoted ? "0 4px 6px -1px rgb(0 0 0 / 0.05)" : "none",
                  opacity: votingFinished && !isVoted && count === 0 ? 0.6 : 1,
                }}
              >
                <Avatar name={p.name} size={52} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: isVoted ? "var(--md-sys-color-on-primary-container)" : "var(--md-sys-color-on-surface)", margin: "0 0 8px", letterSpacing: "-0.01em" }}>{p.name}</p>
                  
                  {true && (
                    <>
                      <div
                        style={{
                          width: "100%",
                          height: 8,
                          background: isVoted ? "rgba(0,0,0,0.1)" : "var(--md-sys-color-surface-variant)",
                          borderRadius: 8,
                          overflow: "hidden"
                        }}
                      >
                        <div
                          style={{
                            width: `${max > 0 ? (count / max) * 100 : 0}%`,
                            height: "100%",
                            borderRadius: 8,
                            background: "var(--md-sys-color-primary)",
                            transition: "width 0.4s cubic-bezier(0.2, 0, 0, 1)",
                          }}
                        />
                      </div>
                      <p style={{ fontSize: 13, color: isVoted ? "var(--md-sys-color-on-primary-container)" : "var(--md-sys-color-on-surface-variant)", marginTop: 6, fontWeight: 600, opacity: 0.8 }}>
                        {count} {t(lang, "votes")}
                      </p>
                    </>
                  )}
                </div>
                {isVoted && (
                  <div style={{ color: "var(--md-sys-color-primary)", display: "flex" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 28 }}>check_circle</span>
                  </div>
                )}
              </div>
            );
          })}
        </Card>

        {me?.isHost && election?.status === "voting" && (
          <Card variant="outlined" style={{ padding: "16px 20px", marginBottom: 24, background: "var(--md-sys-color-surface-container-low)", borderColor: "var(--md-sys-color-outline-variant)" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--md-sys-color-on-surface-variant)", margin: "0 0 12px" }}>{t(lang, "hostSetMayorDirect")}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Button variant="tonal" small onClick={() => emit("host_set_mayor", { mayorPlayerId: null })} style={{ padding: "8px 14px" }}>
                {t(lang, "noOne")}
              </Button>
              {candidates.map((p) => (
                <Button key={p.playerId} variant="tonal" small onClick={() => emit("host_set_mayor", { mayorPlayerId: p.playerId })} style={{ padding: "8px 14px" }}>
                  {p.name}
                </Button>
              ))}
            </div>
          </Card>
        )}
        {totalVotes === voterCount && voterCount > 0 && (
          <span
            style={{
              padding: "10px 18px",
              borderRadius: "var(--radius-lg)",
              fontSize: 14,
              fontWeight: 700,
              background: "var(--md-sys-color-primary-container)",
              color: "var(--md-sys-color-on-primary-container)",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
              border: "1px solid var(--md-sys-color-outline-variant)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>done_all</span>
            {t(lang, "full")}
          </span>
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
          <Button
            variant="filled"
            fullWidth
            onClick={() => emit("mayor_phase_next")}
            style={{ padding: "16px", fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em" }}
          >
            {t(lang, "evaluateNow")}
          </Button>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button 
              variant="tonal" 
              onClick={() => setShowLeaveConfirm(true)}
              style={{ flex: 1, minWidth: 140, padding: "14px", fontSize: 15 }}
            >
              {t(lang, "leaveRound")}
            </Button>
            <Button 
              variant="outlined"
              style={{ flex: 1, minWidth: 140, padding: "14px", fontSize: 15 }}
              onClick={() => {
                if (totalVotes < voterCount) {
                  setShowConfirm(true);
                } else {
                  emit("mayor_phase_next");
                }
              }}
            >
              {t(lang, "showResultNow")}
            </Button>
          </div>
        </footer>
      )}

      <ConfirmModal
        open={showLeaveConfirm}
        title={t(lang, "leaveRound")}
        message={t(lang, "leaveRoundHint")}
        confirmLabel={t(lang, "leaveRound")}
        cancelLabel={t(lang, "closeLabel")}
        onConfirm={() => { setShowLeaveConfirm(false); leave(); }}
        onCancel={() => setShowLeaveConfirm(false)}
      />
      <ConfirmModal
        open={showConfirm}
        title={t(lang, "evaluateVoteNowTitle")}
        message={t(lang, "evaluateVoteNowMessage")}
        confirmLabel={t(lang, "evaluateVoteNowConfirm")}
        cancelLabel={t(lang, "closeLabel")}
        onConfirm={() => {
          setShowConfirm(false);
          emit("mayor_phase_next");
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
