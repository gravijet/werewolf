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
        background: "var(--md-sys-color-background)",
        color: "var(--md-sys-color-on-background)",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header style={{ padding: "40px 20px 32px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "50%", background: "var(--md-sys-color-primary-container)", marginBottom: 20 }}>
          <span className="material-symbols-outlined" style={{ color: "var(--md-sys-color-on-primary-container)", fontSize: 36 }}>dark_mode</span>
        </div>
        <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--md-sys-color-on-surface-variant)", marginBottom: 8 }}>
          {t(lang, "round")} {state?.round ?? 1} · {t(lang, "night")}
        </p>
        <h2 style={{ fontSize: 32, fontWeight: 500, margin: "0 8px 8px", letterSpacing: "0" }}>{t(lang, "nightTitle")}</h2>
        <p style={{ fontSize: 16, fontWeight: 400, color: "var(--md-sys-color-on-surface-variant)", marginTop: 0 }}>{t(lang, "nightCloseEyes")}</p>
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
              background: "var(--md-sys-color-secondary-container)",
              border: "1px solid transparent",
              borderRadius: "var(--radius-xl)",
              position: "relative",
            }}
          >
            <span className="material-symbols-outlined" style={{ color: "var(--md-sys-color-primary)", fontSize: 32, marginTop: 4 }}>masks</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 20, fontWeight: 500, color: "var(--md-sys-color-on-secondary-container)", margin: "0 0 2px" }}>
                {t(lang, myRole) || myRole}
              </p>
              <p style={{ fontSize: 14, fontWeight: 400, color: "var(--md-sys-color-on-surface-variant)", margin: "0 0 8px" }}>{t(lang, "yourRole")}</p>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--md-sys-color-on-surface)", margin: 0 }}>
                {t(lang, `${myRole}_desc`)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => speakText(t(lang, `${myRole}_desc`), lang)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--md-sys-color-primary)",
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

        {myRole === "blinzelmaedchen" && subPhase === "werwolf" && actions.werwolf?.targetId && (() => {
          const targetPlayer = (state?.players ?? []).find(p => p.playerId === actions.werwolf.targetId);
          if (!targetPlayer) return null;
          return (
            <Card style={{ marginBottom: 24, padding: "16px 18px", background: "rgba(236,72,153,0.12)", border: "1px solid rgba(236,72,153,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="material-symbols-outlined" style={{ color: "var(--md-sys-color-primary)", fontSize: 26 }}>visibility</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--md-sys-color-on-surface)" }}>
                    Beobachtet: <strong>{targetPlayer.name}</strong>
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", lineHeight: 1.4 }}>
                    Keine Aktion in dieser Phase.
                  </p>
                </div>
              </div>
            </Card>
          );
        })()}

        {canAct && !hasActed && (
          <Card
            style={{
              padding: "28px 24px",
              background: "var(--md-sys-color-surface)",
              border: "1px solid transparent",
              borderRadius: "var(--radius-xl)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--md-sys-color-primary)" }}>bolt</span>
              <p style={{ fontSize: 14, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--md-sys-color-on-surface-variant)", margin: 0 }}>
                {t(lang, "yourAction")}
              </p>
            </div>
            
            {me?.isHost && subPhase === "werwolf" && (
              <>
                <p style={{ fontSize: 16, fontWeight: 500, color: "var(--md-sys-color-on-surface)", marginBottom: 20, letterSpacing: "-0.01em" }}>Wer ist das Opfer?</p>
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
                        border: "1px solid transparent",
                        background: selectedTarget === p.playerId ? "var(--md-sys-color-error-container)" : "var(--md-sys-color-surface-container-low)",
                        color: "var(--md-sys-color-on-surface)",
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
                <p style={{ fontSize: 16, fontWeight: 500, color: "var(--md-sys-color-on-surface)", marginBottom: 20, letterSpacing: "-0.01em" }}>Welche Person prüfst du?</p>
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
                        border: "1px solid transparent",
                        background: selectedTarget === p.playerId ? "var(--md-sys-color-primary-container)" : "var(--md-sys-color-surface-container-low)",
                        color: "var(--md-sys-color-on-surface)",
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
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--md-sys-color-on-surface)", margin: 0 }}>
                        Opfer der Werwölfe: <strong>{victim.name}</strong>
                      </p>
                    </div>
                  ) : null;
                })()}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--success)" }}>healing</span>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "var(--md-sys-color-on-surface)", margin: 0 }}>
                    {t(lang, "healOptional")} ({state?.witchUsedHeal ? t(lang, "alreadyUsed") : t(lang, "oncePerGame")})
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
                        border: "1px solid transparent",
                        background: hexeHeal === p.playerId ? "color-mix(in srgb, var(--success) 20%, white)" : "var(--md-sys-color-surface-container-low)",
                        color: "var(--md-sys-color-on-surface)",
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
                  {state?.witchUsedHeal && <span style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 14 }}>Heiltrank bereits verbraucht.</span>}
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--md-sys-color-error)" }}>science</span>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "var(--md-sys-color-on-surface)", margin: 0 }}>
                    {t(lang, "poisonOptional")} ({state?.witchUsedPoison ? t(lang, "alreadyUsed") : t(lang, "oncePerGame")})
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
                        border: "1px solid transparent",
                        background: hexePoison === p.playerId ? "var(--md-sys-color-error-container)" : "var(--md-sys-color-surface-container-low)",
                        color: "var(--md-sys-color-on-surface)",
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
                  {state?.witchUsedPoison && <span style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 14 }}>Gifttrank bereits verbraucht.</span>}
                </div>
              </>
            )}

            {myRole === "amor" && subPhase === "amor" && (
              <>
                <p style={{ fontSize: 16, fontWeight: 500, color: "var(--md-sys-color-on-surface)", marginBottom: 16 }}>Wähle zwei Verliebte.</p>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--md-sys-color-on-surface-variant)", marginBottom: 8 }}>Erste Person</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {alive.filter((p) => p.playerId !== amorLover2).map((p) => (
                      <button key={p.playerId} type="button" className="md-state-layer" onClick={() => setAmorLover1(amorLover1 === p.playerId ? null : p.playerId)}
                        style={{ padding: "12px 18px", borderRadius: 12, border: "1px solid transparent", background: amorLover1 === p.playerId ? "var(--md-sys-color-tertiary-container)" : "var(--md-sys-color-surface-container-low)", color: "var(--md-sys-color-on-surface)", fontWeight: 600 }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--md-sys-color-on-surface-variant)", marginBottom: 8 }}>Zweite Person</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {alive.filter((p) => p.playerId !== amorLover1).map((p) => (
                      <button key={p.playerId} type="button" className="md-state-layer" onClick={() => setAmorLover2(amorLover2 === p.playerId ? null : p.playerId)}
                        style={{ padding: "12px 18px", borderRadius: 12, border: "1px solid transparent", background: amorLover2 === p.playerId ? "var(--md-sys-color-tertiary-container)" : "var(--md-sys-color-surface-container-low)", color: "var(--md-sys-color-on-surface)", fontWeight: 600 }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {myRole === "baecker" && subPhase === "baecker" && (
              <>
                <p style={{ fontSize: 16, fontWeight: 500, color: "var(--md-sys-color-on-surface)", marginBottom: 20 }}>Wer darf morgen nicht abstimmen?</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {alive.map((p) => (
                    <button key={p.playerId} type="button" className="md-state-layer" onClick={() => setBaeckerTarget(baeckerTarget === p.playerId ? null : p.playerId)}
                      style={{ padding: "14px 20px", borderRadius: 16, border: "1px solid transparent", background: baeckerTarget === p.playerId ? "var(--md-sys-color-secondary-container)" : "var(--md-sys-color-surface-container-low)", color: "var(--md-sys-color-on-surface)", fontWeight: 600 }}>
                      {p.name}
                      {baeckerTarget === p.playerId && <span className="material-symbols-outlined" style={{ fontSize: 18, marginLeft: 6 }}>check_circle</span>}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", marginTop: 12 }}>Du kannst ohne Ziel fortfahren.</p>
              </>
            )}
            
            <Button
              onClick={submitAction}
              style={{
                width: "100%",
                padding: "18px 24px",
                minHeight: 56,
                background: (myRole === "hexe" && !hexeHeal && !hexePoison) ? "var(--md-sys-color-surface-container-high)" : "var(--md-sys-color-primary)",
                border: "1px solid transparent",
                color: (myRole === "hexe" && !hexeHeal && !hexePoison) ? "var(--md-sys-color-on-surface)" : "var(--md-sys-color-on-primary)",
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
            background: "color-mix(in srgb, var(--success) 16%, white)",
            border: "1px solid transparent",
            borderRadius: "var(--radius-lg)",
            color: "var(--md-sys-color-on-surface)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--success)" }}>check_circle</span>
            <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>{t(lang, "actionConfirm")}</span>
            {myRole === "seher" && seherResultPlayer && (
              <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid rgba(16,185,129,0.2)", width: "100%" }}>
                  <p style={{ fontSize: 14, color: "var(--md-sys-color-on-surface-variant)", margin: "0 0 8px" }}>Ergebnis für <strong>{seherResultPlayer.name}</strong>:</p>
                {exactRole ? (
                  <p style={{ 
                    fontSize: 18, 
                    fontWeight: 700, 
                    color: "var(--md-sys-color-on-surface)",
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8
                  }}>
                    <span className="material-symbols-outlined" style={{ color: "var(--md-sys-color-primary)" }}>visibility</span>
                    Rolle: {t(lang, exactRole) || exactRole}
                  </p>
                ) : (
                  <p style={{ 
                    fontSize: 18, 
                    fontWeight: 700, 
                    color: isTargetEvil ? "var(--md-sys-color-error)" : "var(--md-sys-color-primary)",
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
            background: "var(--md-sys-color-surface)",
            border: "1px solid transparent",
            borderRadius: "var(--radius-lg)",
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
              <button type="button" onClick={() => speakCurrent()} style={{ padding: "8px 16px", borderRadius: 999, border: "1px solid transparent", background: "var(--md-sys-color-surface)", color: "var(--md-sys-color-on-surface)", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "var(--shadow-1)" }} title={t(lang, "readAloud")}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>volume_up</span>
                {t(lang, "playAudio")}
              </button>
              <Button variant="tonal" onClick={() => emit("host_skip_phase")} style={{ padding: "8px 16px" }}>
                Phase überspringen
              </Button>
            </div>
          </div>
          {subPhase === "werwolf" && actions.werwolf?.targetId && (
            <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", margin: "0 0 12px" }}>Werwölfe: bereit</p>
          )}
          {subPhase === "seher" && (state?.players ?? []).filter(p => p.role === "seher" && p.isAlive).some(p => actions.seher?.targetId) && (
            <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", margin: "0 0 12px" }}>Seher: bereit</p>
          )}
          {subPhase === "hexe" && (actions.hexe?.healId || actions.hexe?.poisonId || actions.hexe?.passed) && (
            <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", margin: "0 0 12px" }}>Hexe: bereit</p>
          )}
          {subPhase === "amor" && (actions.amor?.lover1Id && actions.amor?.lover2Id) && (
            <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", margin: "0 0 12px" }}>Amor: bereit</p>
          )}
          {subPhase === "baecker" && (actions.baecker?.targetId != null || actions.baecker?.passed) && (
            <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", margin: "0 0 12px" }}>Bäcker: bereit</p>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button
              variant="tonal"
              onClick={() => leave()}
              style={{ flex: 1, minWidth: 140, padding: "14px", fontSize: 15, fontWeight: 600 }}
            >
              {t(lang, "leaveRound")}
            </Button>
            <Button
              variant="filled"
              onClick={() => emit("phase_next")}
              style={{ flex: 1, minWidth: 140, padding: "14px", fontSize: 15, fontWeight: 600 }}
            >
              {t(lang, "nextPhase")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
