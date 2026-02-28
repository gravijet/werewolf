import React, { useMemo } from "react";
import { useGame } from "../context/GameContext";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Avatar } from "../components/Avatar";
import { PhaseBar } from "../components/PhaseBar";
import { t } from "../i18n/translations";

export function MayorScreen({ lang }) {
  const { state, me, emit } = useGame();
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
  const voterCount = players.filter(p => !p.isHost).length;
  const [showConfirm, setShowConfirm] = React.useState(false);

  // Auto-evaluate when all have voted
  React.useEffect(() => {
    if (me?.isHost && totalVotes === voterCount && voterCount > 0 && election?.status === "voting") {
      emit("mayor_phase_next");
    }
  }, [me?.isHost, totalVotes, voterCount, election?.status, emit]);

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
            const hasVoted = myVote !== undefined && myVote !== null;
            const votingFinished = election?.status === "decided" || election?.status === "tie_redo";
            const canVote = !me?.isHost && !votingFinished && !hasVoted;
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

        {totalVotes === voterCount && voterCount > 0 && (
          <span
            style={{
              padding: "8px 16px",
              borderRadius: "var(--r-pill)",
              fontSize: 13,
              fontWeight: 700,
              background: "var(--success-bg)",
              color: "var(--success)",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>done_all</span>
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
            fullWidth 
            onClick={() => {
              if (totalVotes < voterCount) {
                setShowConfirm(true);
              } else {
                emit("mayor_phase_next");
              }
            }} 
            style={{ padding: "16px", fontSize: 16 }}
          >
            {t(lang, "showResult")}
          </Button>
        </footer>
      )}

      {showConfirm && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: 20
        }}>
          <Card style={{ maxWidth: 400, width: "100%", padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 20, color: "var(--md-sys-color-on-surface)" }}>
              Auswerten?
            </h3>
            <p style={{ margin: "0 0 24px", color: "var(--md-sys-color-on-surface-variant)", lineHeight: 1.5 }}>
              Es haben noch nicht alle Spieler abgestimmt. Willst du die Wahl trotzdem jetzt beenden und auswerten?
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Button variant="text" onClick={() => setShowConfirm(false)}>
                Abbrechen
              </Button>
              <Button onClick={() => {
                setShowConfirm(false);
                emit("mayor_phase_next");
              }}>
                Auswerten
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
