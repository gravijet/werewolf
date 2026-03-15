import React, { useState } from "react";
import { useGame } from "../context/GameContext";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { t, speakText } from "../i18n/translations";
import { useHostAudio } from "../audio/useHostAudio";

export function NightScreen({ lang }) {
  const { state, me, emit, leave } = useGame();
  const night = state?.night;
  const subPhase = night?.subPhase ?? "werwolf";
  const actions = night?.actions ?? {};
  const alive = (state?.players ?? []).filter((p) => p.isAlive && p.playerId !== me?.playerId);
  const myRole = me ? (state?.players?.find((p) => p.playerId === me.playerId)?.role) : null;

  const [selectedTarget, setSelectedTarget] = useState(null);
  const [hexeHeal, setHexeHeal] = useState(null);
  const [hexePoison, setHexePoison] = useState(null);
  const [amorLover1, setAmorLover1] = useState(null);
  const [amorLover2, setAmorLover2] = useState(null);
  const [baeckerTarget, setBaeckerTarget] = useState(null);

  const { speakCurrent } = useHostAudio(state?.phase, night?.subPhase, me?.isHost);

  const canAct =
    (me?.isHost && subPhase === "werwolf") ||
    (myRole === "seher" && subPhase === "seher") ||
    (myRole === "hexe" && subPhase === "hexe") ||
    (myRole === "amor" && subPhase === "amor") ||
    (myRole === "baecker" && subPhase === "baecker");

  const submitAction = () => {
    if (me?.isHost && subPhase === "werwolf" && selectedTarget) emit("night_action", { targetId: selectedTarget });
    if (myRole === "seher" && selectedTarget) emit("night_action", { targetId: selectedTarget });
    if (myRole === "hexe") emit("night_action", { healId: hexeHeal || undefined, poisonId: hexePoison || undefined });
    if (myRole === "amor" && amorLover1 && amorLover2) emit("night_action", { lover1Id: amorLover1, lover2Id: amorLover2 });
    if (myRole === "baecker") emit("night_action", { targetId: baeckerTarget || null });
  };

  const hasActed =
    (me?.isHost && subPhase === "werwolf" && actions.werwolf?.targetId) ||
    (myRole === "seher" && actions.seher?.targetId) ||
    (myRole === "hexe" && (actions.hexe?.healId || actions.hexe?.poisonId || actions.hexe?.passed)) ||
    (myRole === "amor" && (actions.amor?.lover1Id && actions.amor?.lover2Id)) ||
    (myRole === "baecker" && (actions.baecker?.targetId != null || actions.baecker?.passed));

  const seherResultId = actions.seher?.targetId;
  const seherResultPlayer = seherResultId ? (state?.players ?? []).find(p => p.playerId === seherResultId) : null;
  const isTargetEvil = actions.seher?.isTargetEvil;
  const exactRole = actions.seher?.exactRole;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#000000", // pure black for darker night feel
        color: "#f8fafc",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header style={{ padding: "40px 20px 32px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "50%", background: "rgba(147,197,253,0.1)", marginBottom: 20 }}>
          <span className="material-symbols-outlined" style={{ color: "#93c5fd", fontSize: 36 }}>dark_mode</span>
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(147,197,253,0.5)", marginBottom: 8 }}>
          {t(lang, "round")} {state?.round ?? 1} · {t(lang, "night")}
        </p>
        <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 8px 8px", letterSpacing: "-0.03em" }}>{t(lang, "nightTitle")}</h2>
        <p style={{ fontSize: 16, fontWeight: 500, color: "rgba(147,197,253,0.7)", marginTop: 0, letterSpacing: "-0.01em" }}>{t(lang, "nightCloseEyes")}</p>
      </header>

      <div style={{ flex: 1, padding: "0 20px" }}>
        {myRole && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
              padding: "20px 24px",
              marginBottom: 24,
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.2)",
              borderRadius: "var(--radius-lg)",
              position: "relative",
            }}
          >
            <span className="material-symbols-outlined" style={{ color: "#60a5fa", fontSize: 32, marginTop: 4 }}>masks</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#60a5fa", margin: "0 0 2px", letterSpacing: "-0.01em" }}>
                {t(lang, myRole) || myRole}
              </p>
              <p style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.6)", margin: "0 0 8px", letterSpacing: "0px" }}>{t(lang, "yourRole")}</p>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,0.8)", margin: 0 }}>
                {t(lang, `${myRole}_desc`)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => speakText(t(lang, `${myRole}_desc`), lang)}
              style={{
                background: "transparent",
                border: "none",
                color: "#60a5fa",
                cursor: "pointer",
                padding: 8,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title={t(lang, "readAloud")}
            >
              <span className="material-symbols-outlined">volume_up</span>
            </button>
          </div>
        )}

        {canAct && !hasActed && (
          <Card
            style={{
              padding: "28px 24px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: "rgba(255,255,255,0.9)" }}>bolt</span>
              <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", color: "rgba(255,255,255,0.9)", margin: 0 }}>
                {t(lang, "yourAction")}
              </p>
            </div>
            
            {me?.isHost && subPhase === "werwolf" && (
              <>
                <p style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.8)", marginBottom: 20, letterSpacing: "-0.01em" }}>Wen fressen die Werwölfe diese Nacht?</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
                  {alive.filter(p => p.role !== "werwolf").map((p) => (
                    <button
                      key={p.playerId}
                      type="button"
                      className="md-state-layer"
                      onClick={() => setSelectedTarget(p.playerId)}
                      style={{
                        padding: "16px 12px",
                        borderRadius: "16px",
                        border: `2px solid ${selectedTarget === p.playerId ? "#ef4444" : "rgba(255,255,255,0.1)"}`,
                        background: selectedTarget === p.playerId ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.03)",
                        color: "#fff",
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            
            {myRole === "seher" && (
              <>
                <p style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.8)", marginBottom: 20, letterSpacing: "-0.01em" }}>Wen möchtest du beschauen?</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
                  {alive.map((p) => (
                    <button
                      key={p.playerId}
                      type="button"
                      className="md-state-layer"
                      onClick={() => setSelectedTarget(p.playerId)}
                      style={{
                        padding: "16px 12px",
                        borderRadius: "16px",
                        border: `2px solid ${selectedTarget === p.playerId ? "#3b82f6" : "rgba(255,255,255,0.1)"}`,
                        background: selectedTarget === p.playerId ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.03)",
                        color: "#fff",
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            
            {myRole === "hexe" && (
              <>
                {night?.actions?.werwolf?.targetId && (() => {
                  const victim = (state?.players ?? []).find(p => p.playerId === night.actions.werwolf.targetId);
                  return victim ? (
                    <div style={{ marginBottom: 24, padding: "14px 18px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)", margin: 0 }}>
                        Opfer dieser Nacht: <strong>{victim.name}</strong>
                      </p>
                    </div>
                  ) : null;
                })()}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#10b981" }}>healing</span>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.9)", margin: 0 }}>
                    Heilen (optional) {state?.witchUsedHeal ? "– bereits verbraucht" : "– 1× im Spiel"}
                  </p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
                  {!state?.witchUsedHeal && alive.map((p) => (
                    <button
                      key={p.playerId}
                      type="button"
                      className="md-state-layer"
                      onClick={() => { setHexeHeal(hexeHeal === p.playerId ? null : p.playerId); setHexePoison(null); }}
                      style={{
                        padding: "14px 20px",
                        borderRadius: "16px",
                        border: `2px solid ${hexeHeal === p.playerId ? "#10b981" : "rgba(255,255,255,0.1)"}`,
                        background: hexeHeal === p.playerId ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)",
                        color: "#fff",
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        overflow: "hidden",
                      }}
                    >
                      {p.name}
                      {hexeHeal === p.playerId && <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>}
                    </button>
                  ))}
                  {state?.witchUsedHeal && <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Heiltrank bereits verbraucht.</span>}
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#ef4444" }}>science</span>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.9)", margin: 0 }}>
                    Vergiften (optional) {state?.witchUsedPoison ? "– bereits verbraucht" : "– 1× im Spiel"}
                  </p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
                  {!state?.witchUsedPoison && alive.map((p) => (
                    <button
                      key={p.playerId}
                      type="button"
                      className="md-state-layer"
                      onClick={() => { setHexePoison(hexePoison === p.playerId ? null : p.playerId); setHexeHeal(null); }}
                      style={{
                        padding: "14px 20px",
                        borderRadius: "16px",
                        border: `2px solid ${hexePoison === p.playerId ? "#ef4444" : "rgba(255,255,255,0.1)"}`,
                        background: hexePoison === p.playerId ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.03)",
                        color: "#fff",
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        overflow: "hidden",
                      }}
                    >
                      {p.name}
                      {hexePoison === p.playerId && <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>}
                    </button>
                  ))}
                  {state?.witchUsedPoison && <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Gifttrank bereits verbraucht.</span>}
                </div>
              </>
            )}

            {myRole === "amor" && subPhase === "amor" && (
              <>
                <p style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.8)", marginBottom: 16 }}>Wähle zwei Spieler, die sich verlieben sollen (Liebespaar).</p>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>Erste Person</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {alive.filter((p) => p.playerId !== amorLover2).map((p) => (
                      <button key={p.playerId} type="button" className="md-state-layer" onClick={() => setAmorLover1(amorLover1 === p.playerId ? null : p.playerId)}
                        style={{ padding: "12px 18px", borderRadius: 12, border: `2px solid ${amorLover1 === p.playerId ? "#ec4899" : "rgba(255,255,255,0.1)"}`, background: amorLover1 === p.playerId ? "rgba(236,72,153,0.2)" : "rgba(255,255,255,0.05)", color: "#fff", fontWeight: 600 }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>Zweite Person</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {alive.filter((p) => p.playerId !== amorLover1).map((p) => (
                      <button key={p.playerId} type="button" className="md-state-layer" onClick={() => setAmorLover2(amorLover2 === p.playerId ? null : p.playerId)}
                        style={{ padding: "12px 18px", borderRadius: 12, border: `2px solid ${amorLover2 === p.playerId ? "#ec4899" : "rgba(255,255,255,0.1)"}`, background: amorLover2 === p.playerId ? "rgba(236,72,153,0.2)" : "rgba(255,255,255,0.05)", color: "#fff", fontWeight: 600 }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {myRole === "baecker" && subPhase === "baecker" && (
              <>
                <p style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.8)", marginBottom: 20 }}>Wem willst du diesmal das Maul stopfen? (Kann am Tag nicht abstimmen.)</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {alive.map((p) => (
                    <button key={p.playerId} type="button" className="md-state-layer" onClick={() => setBaeckerTarget(baeckerTarget === p.playerId ? null : p.playerId)}
                      style={{ padding: "14px 20px", borderRadius: 16, border: `2px solid ${baeckerTarget === p.playerId ? "#eab308" : "rgba(255,255,255,0.1)"}`, background: baeckerTarget === p.playerId ? "rgba(234,179,8,0.2)" : "rgba(255,255,255,0.03)", color: "#fff", fontWeight: 600 }}>
                      {p.name}
                      {baeckerTarget === p.playerId && <span className="material-symbols-outlined" style={{ fontSize: 18, marginLeft: 6 }}>check_circle</span>}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 12 }}>Optional: Niemanden wählen (Button unten ohne Auswahl klicken).</p>
              </>
            )}
            
            <Button
              onClick={submitAction}
              style={{
                width: "100%",
                padding: "18px 24px",
                minHeight: 56,
                background: (myRole === "hexe" && !hexeHeal && !hexePoison) ? "rgba(255,255,255,0.1)" : "#fafafa",
                border: "none",
                color: (myRole === "hexe" && !hexeHeal && !hexePoison) ? "#fff" : "#000",
                fontSize: 16,
                fontWeight: 700,
                borderRadius: "var(--r-pill)",
              }}
              disabled={
                (me?.isHost && subPhase === "werwolf") || myRole === "seher" ? !selectedTarget :
                myRole === "amor" ? !(amorLover1 && amorLover2) :
                false
              }
            >
              {t(lang, "actionConfirm")}
            </Button>
          </Card>
        )}

        {canAct && hasActed && (
          <div
            style={{
              padding: "24px",
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: "var(--radius-lg)",
              color: "#fff",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: "#10b981" }}>check_circle</span>
            <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>{t(lang, "actionConfirm")}</span>
            {myRole === "seher" && seherResultPlayer && (
              <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid rgba(16,185,129,0.2)", width: "100%" }}>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", margin: "0 0 8px" }}>Dein Ergebnis für <strong>{seherResultPlayer.name}</strong>:</p>
                {exactRole ? (
                  <p style={{ 
                    fontSize: 18, 
                    fontWeight: 700, 
                    color: "#f8fafc",
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8
                  }}>
                    <span className="material-symbols-outlined" style={{ color: "#3b82f6" }}>visibility</span>
                    Rolle: {t(lang, exactRole) || exactRole}
                  </p>
                ) : (
                  <p style={{ 
                    fontSize: 18, 
                    fontWeight: 700, 
                    color: isTargetEvil ? "#ef4444" : "#3b82f6",
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8
                  }}>
                    <span className="material-symbols-outlined">{isTargetEvil ? "visibility_off" : "visibility"}</span>
                    {isTargetEvil ? t(lang, "targetEvil") : t(lang, "targetGood")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {me?.isHost && (
        <div
          style={{
            margin: "32px 20px 16px",
            padding: 24,
            paddingBottom: "max(24px, env(safe-area-inset-bottom))",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "var(--radius-lg)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--md-sys-color-primary)" }}>admin_panel_settings</span>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--md-sys-color-on-surface)" }}>
                {t(lang, "hostControl")}
              </span>
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => speakCurrent()} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }} title={t(lang, "readAloud")}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>volume_up</span>
                {t(lang, "playAudio")}
              </button>
              <Button variant="tonal" onClick={() => emit("host_skip_phase")} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>
                Phase überspringen
              </Button>
            </div>
          </div>
          {subPhase === "werwolf" && actions.werwolf?.targetId && (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", margin: "0 0 12px" }}>Werwölfe: bereit</p>
          )}
          {subPhase === "seher" && (state?.players ?? []).filter(p => p.role === "seher" && p.isAlive).some(p => actions.seher?.targetId) && (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", margin: "0 0 12px" }}>Seher: bereit</p>
          )}
          {subPhase === "hexe" && (actions.hexe?.healId || actions.hexe?.poisonId || actions.hexe?.passed) && (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", margin: "0 0 12px" }}>Hexe: bereit</p>
          )}
          {subPhase === "amor" && (actions.amor?.lover1Id && actions.amor?.lover2Id) && (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", margin: "0 0 12px" }}>Amor: bereit</p>
          )}
          {subPhase === "baecker" && (actions.baecker?.targetId != null || actions.baecker?.passed) && (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", margin: "0 0 12px" }}>Bäcker: bereit</p>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button
              variant="tonal"
              onClick={() => leave()}
              style={{ flex: 1, minWidth: 120, padding: "16px", fontSize: 16, fontWeight: 600, background: "rgba(255,255,255,0.1)", color: "#fff" }}
            >
              {t(lang, "leaveRound")}
            </Button>
            <Button
              variant="filled"
              onClick={() => emit("phase_next")}
              style={{ flex: 1, minWidth: 120, padding: "16px", fontSize: 16, fontWeight: 600 }}
            >
              {t(lang, "nextPhase")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
