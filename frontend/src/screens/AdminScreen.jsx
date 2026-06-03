import React, { useState } from "react";
import { useGame } from "../context/GameContext";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Avatar } from "../components/Avatar";
import { t } from "../i18n/translations";

export function AdminScreen({ lang, onClose }) {
  const { state, me, emit } = useGame();
  const [activeTab, setActiveTab] = useState("players");
  const [editingNameId, setEditingNameId] = useState(null);
  const [editNameValue, setEditNameValue] = useState("");
  
  const players = state?.players ?? [];
  const bannedPlayers = state?.bannedPlayers ?? [];
  const rules = state?.rules ?? {};

  const handleRuleChange = (key, value) => {
    emit("admin_set_rules", { rules: { [key]: value } });
  };

  const ToggleSwitch = ({ checked, onChange, label }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        width: 56,
        height: 32,
        borderRadius: 16,
        border: "none",
        flexShrink: 0,
        background: checked ? "var(--md-sys-color-primary)" : "var(--md-sys-color-surface-variant)",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        outlineOffset: 2,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 4,
          left: checked ? 28 : 4,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: checked ? "var(--md-sys-color-on-primary)" : "var(--md-sys-color-outline)",
          transition: "left 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      />
    </button>
  );

  const TabButton = ({ id, label, icon }) => (
    <button
      type="button"
      className="md-state-layer"
      role="tab"
      aria-selected={activeTab === id}
      aria-controls={`panel-${id}`}
      id={`tab-${id}`}
      onClick={() => setActiveTab(id)}
      style={{
        flex: 1,
        padding: "16px 12px",
        background: "transparent",
        border: "none",
        borderBottom: `2px solid ${activeTab === id ? "var(--md-sys-color-primary)" : "transparent"}`,
        color: activeTab === id ? "var(--md-sys-color-primary)" : "var(--md-sys-color-on-surface-variant)",
        fontWeight: 600,
        fontSize: 15,
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        letterSpacing: "-0.01em",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 24, fontVariationSettings: activeTab === id ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--md-sys-color-background)" }}>
      <header
        style={{
          background: "var(--md-sys-color-surface)",
          borderBottom: "1px solid var(--md-sys-color-outline-variant)",
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "20px 24px",
        }}
      >
        <Avatar name={me?.name || "A"} size={48} style={me?.isAdmin ? { background: "var(--md-sys-color-error)", color: "var(--md-sys-color-on-error)" } : {}} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--md-sys-color-on-surface)", letterSpacing: "-0.01em" }}>
            {me?.isAdmin ? t(lang, "adminPanel") : t(lang, "hostSettings")}
          </div>
        </div>
        {me?.isAdmin && (
          <span
            style={{
              padding: "6px 12px",
              borderRadius: "var(--r-pill)",
              fontSize: 13,
              fontWeight: 700,
              background: "var(--md-sys-color-error-container)",
              color: "var(--md-sys-color-on-error-container)",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            Admin
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="md-state-layer"
          aria-label={lang === "de" ? t(lang, "closeLabel") : "Close"}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "none",
            background: "var(--md-sys-color-surface-variant)",
            cursor: "pointer",
            color: "var(--md-sys-color-on-surface-variant)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>close</span>
        </button>
      </header>

      <div role="tablist" aria-label={t(lang, "gameSettings")} style={{ display: "flex", background: "var(--md-sys-color-surface)", borderBottom: "1px solid var(--md-sys-color-outline-variant)" }}>
        <TabButton id="rules" label={t(lang, "rules")} icon="gavel" />
        <TabButton id="players" label={t(lang, "players")} icon="group" />
        {me?.isAdmin && <TabButton id="banned" label={t(lang, "bannedPlayers")} icon="block" />}
      </div>

      <div style={{ flex: 1, padding: 24, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", display: "flex", flexDirection: "column", gap: 24 }}>
        {activeTab === "rules" && (
          <div role="tabpanel" id="panel-rules" aria-labelledby="tab-rules">
            <Card style={{ padding: "28px 24px", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <span className="material-symbols-outlined" style={{ color: "var(--md-sys-color-primary)", fontSize: 24 }}>settings_suggest</span>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--md-sys-color-on-surface)", letterSpacing: "-0.01em" }}>
                  {t(lang, "gameRules")}
                </h3>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: "var(--md-sys-color-on-surface)", display: "block", marginBottom: 6, letterSpacing: "-0.01em" }}>
                    {t(lang, "mayorEnabled")}
                  </span>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "var(--md-sys-color-on-surface-variant)", margin: 0, lineHeight: 1.5 }}>
                    {t(lang, "mayorEnabledHelp")}
                  </p>
                </div>
                <ToggleSwitch
                  checked={rules.mayorElectionEnabled !== false}
                  onChange={(v) => handleRuleChange("mayorElectionEnabled", v)}
                  label={t(lang, "mayorEnabled")}
                />
              </div>

              <hr style={{ border: "none", height: 1, background: "var(--md-sys-color-outline-variant)", margin: "20px 0" }} />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: "var(--md-sys-color-on-surface)", display: "block", marginBottom: 6, letterSpacing: "-0.01em" }}>
                    {t(lang, "revealRolesToDead")}
                  </span>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "var(--md-sys-color-on-surface-variant)", margin: 0, lineHeight: 1.5 }}>
                    {t(lang, "revealRolesToDeadHelp")}
                  </p>
                </div>
                <ToggleSwitch
                  checked={rules.revealRolesToDead !== false}
                  onChange={(v) => handleRuleChange("revealRolesToDead", v)}
                  label={t(lang, "revealRolesToDead")}
                />
              </div>

              <hr style={{ border: "none", height: 1, background: "var(--md-sys-color-outline-variant)", margin: "20px 0" }} />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label htmlFor="rule-votetime" style={{ fontSize: 16, fontWeight: 600, color: "var(--md-sys-color-on-surface)", display: "block", marginBottom: 6, letterSpacing: "-0.01em" }}>
                    {t(lang, "voteDurationLabel")}
                  </label>
                </div>
                <select
                  id="rule-votetime"
                  value={Number(rules.voteDurationSeconds) || 180}
                  onChange={(e) => handleRuleChange("voteDurationSeconds", parseInt(e.target.value, 10))}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--md-sys-color-outline-variant)",
                    fontSize: 16,
                    fontWeight: 500,
                    background: "var(--md-sys-color-surface-container-low)",
                    color: "var(--md-sys-color-on-surface)",
                    cursor: "pointer",
                  }}
                >
                  {[60, 90, 120, 180, 240, 300].map((s) => (
                    <option key={s} value={s}>{s} {t(lang, "seconds")}</option>
                  ))}
                </select>
              </div>
            </Card>

            <Card style={{ padding: "28px 24px", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <span className="material-symbols-outlined" style={{ color: "var(--md-sys-color-primary)", fontSize: 24 }}>visibility</span>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--md-sys-color-on-surface)", letterSpacing: "-0.01em" }}>
                  {t(lang, "seherMode")}
                </h3>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => handleRuleChange("seherMode", "good_evil")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "16px",
                    borderRadius: "12px",
                    background: rules.seherMode !== "exact_role" ? "var(--md-sys-color-primary-container)" : "var(--md-sys-color-surface)",
                    color: rules.seherMode !== "exact_role" ? "var(--md-sys-color-on-primary-container)" : "var(--md-sys-color-on-surface)",
                    border: `1px solid ${rules.seherMode !== "exact_role" ? "var(--md-sys-color-primary)" : "var(--md-sys-color-outline-variant)"}`,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s"
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{rules.seherMode !== "exact_role" ? "radio_button_checked" : "radio_button_unchecked"}</span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{t(lang, "seherModeGoodEvil")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRuleChange("seherMode", "exact_role")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "16px",
                    borderRadius: "12px",
                    background: rules.seherMode === "exact_role" ? "var(--md-sys-color-primary-container)" : "var(--md-sys-color-surface)",
                    color: rules.seherMode === "exact_role" ? "var(--md-sys-color-on-primary-container)" : "var(--md-sys-color-on-surface)",
                    border: `1px solid ${rules.seherMode === "exact_role" ? "var(--md-sys-color-primary)" : "var(--md-sys-color-outline-variant)"}`,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s"
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{rules.seherMode === "exact_role" ? "radio_button_checked" : "radio_button_unchecked"}</span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{t(lang, "seherModeExact")}</span>
                </button>
              </div>
            </Card>

            {/* Rollen */}
            {(() => {
              const playerCount = players.filter((p) => !p.isHost).length;
              const roleIds = ["werwolf", "seher", "hexe", "dorfbewohner", "amor", "kopfgeldjaeger", "jaeger", "blinzelmaedchen", "baecker"];
              const totalRoles = roleIds.reduce((s, roleId) => {
                const r = rules.roles?.[roleId] ?? {};
                if (!r.enabled) return s;
                if (roleId === "werwolf" && r.count === "1/3") return s + Math.max(1, Math.floor(playerCount / 3));
                return s + (Number(r.count) || 0);
              }, 0);
              const ok = totalRoles === playerCount && playerCount >= 3;

              return (
                <Card style={{ padding: "28px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <span className="material-symbols-outlined" style={{ color: "var(--md-sys-color-primary)", fontSize: 24 }}>theater_comedy</span>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--md-sys-color-on-surface)", letterSpacing: "-0.01em" }}>
                      {t(lang, "roleCountsTotal")}
                    </h3>
                  </div>
                  <p id="rules-desc" style={{ fontSize: 14, fontWeight: 500, color: "var(--md-sys-color-on-surface-variant)", marginBottom: 24, lineHeight: 1.5 }}>
                    {t(lang, "rolesHelp")}
                  </p>
                  <div style={{ display: "grid", gap: 16 }}>
                    {roleIds.map((roleId) => {
                      const r = rules.roles?.[roleId] ?? {};
                      const count = r.enabled ? (r.count === "1/3" ? "1/3" : (Number(r.count) || 0)) : 0;
                      const num = typeof count === "number" ? count : null;
                      const roleLabel = t(lang, roleId) || roleId;
                      const inputId = "rule-" + roleId;
                      return (
                        <div
                          key={roleId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 16,
                            padding: "16px",
                            borderRadius: "16px",
                            background: "var(--md-sys-color-surface)",
                            border: "1px solid var(--md-sys-color-outline-variant)",
                            transition: "border-color 0.2s",
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = "var(--md-sys-color-primary)"}
                          onBlur={(e) => e.currentTarget.style.borderColor = "var(--md-sys-color-outline-variant)"}
                        >
                          <div style={{ flex: 1 }}>
                            <label htmlFor={inputId} style={{ fontSize: 16, fontWeight: 600, color: "var(--md-sys-color-on-surface)", cursor: "pointer", letterSpacing: "-0.01em", display: "block" }}>
                              {roleLabel}
                            </label>
                            <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", margin: "4px 0 0", lineHeight: 1.4 }}>
                              {t(lang, `${roleId}_desc`)}
                            </p>
                          </div>
                          {roleId === "werwolf" ? (
                            <select
                              id={inputId}
                              value={count}
                              onChange={(e) => {
                                const v = e.target.value;
                                handleRuleChange("roles", {
                                  ...rules.roles,
                                  [roleId]: { ...r, enabled: true, count: v === "1/3" ? "1/3" : parseInt(v, 10) || 0 },
                                });
                              }}
                              aria-label={t(lang, "roleCountLabel") + " " + roleLabel}
                              style={{
                                padding: "10px 14px",
                                borderRadius: "10px",
                                border: "1px solid var(--md-sys-color-outline-variant)",
                                fontSize: 16,
                                fontWeight: 500,
                                minWidth: 80,
                                background: "var(--md-sys-color-surface-container-low)",
                                color: "var(--md-sys-color-on-surface)",
                                outline: "none",
                                cursor: "pointer",
                                transition: "all 0.2s",
                              }}
                            >
                              <option value="1/3">1/3</option>
                              {[1, 2, 3, 4, 5, 6].map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id={inputId}
                              type="number"
                              min={0}
                              max={20}
                              value={num ?? 0}
                              onChange={(e) => {
                                const v = Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0));
                                handleRuleChange("roles", {
                                  ...rules.roles,
                                  [roleId]: { ...r, enabled: v > 0, count: v },
                                });
                              }}
                              aria-label={t(lang, "roleCountLabel") + " " + roleLabel}
                              style={{
                                width: 80,
                                padding: "10px 14px",
                                borderRadius: "10px",
                                border: "1px solid var(--md-sys-color-outline-variant)",
                                fontSize: 16,
                                fontWeight: 500,
                                background: "var(--md-sys-color-surface-container-low)",
                                color: "var(--md-sys-color-on-surface)",
                                outline: "none",
                                transition: "all 0.2s",
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div
                    role="status"
                    aria-live="polite"
                    style={{
                      marginTop: 32,
                      padding: "20px",
                      borderRadius: "16px",
                      fontSize: 15,
                      fontWeight: 600,
                      background: ok ? "var(--md-sys-color-secondary-container)" : "var(--md-sys-color-error-container)",
                      color: ok ? "var(--md-sys-color-on-secondary-container)" : "var(--md-sys-color-on-error-container)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 28 }}>{ok ? "check_circle" : "error"}</span>
                    <div>
                      <div>{t(lang, "playersCurrent")}: {playerCount} · {t(lang, "roleCountsTotal")}: {totalRoles}</div>
                      <div style={{ marginTop: 4 }}>{ok ? t(lang, "rolesMatch") : t(lang, "rolesMismatch")}</div>
                    </div>
                  </div>
                </Card>
              );
            })()}
          </div>
        )}

        {activeTab === "players" && (
          <div role="tabpanel" id="panel-players" aria-labelledby="tab-players">
          <Card style={{ padding: 0 }}>
            {players.map((p, i) => (
              <div
                key={p.playerId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  padding: "20px 24px",
                  borderBottom: i < players.length - 1 ? "1px solid var(--md-sys-color-outline-variant)" : "none",
                  flexWrap: "wrap",
                }}
              >
                <Avatar name={p.name} size={56} />
                <div style={{ flex: "1 1 100px", minWidth: 0 }}>
                  {editingNameId === p.playerId ? (
                    <input
                      autoFocus
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      onBlur={() => {
                        const name = (editNameValue || "").trim() || p.name;
                        emit("admin_change_name", { targetPlayerId: p.playerId, newName: name });
                        setEditingNameId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.target.blur();
                        else if (e.key === "Escape") {
                          setEditNameValue(p.name);
                          setEditingNameId(null);
                        }
                      }}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "2px solid var(--md-sys-color-primary)",
                        fontSize: 16,
                        fontWeight: 600,
                        width: "100%",
                        maxWidth: 280,
                        background: "var(--md-sys-color-surface)",
                        color: "var(--md-sys-color-on-surface)",
                        outline: "none",
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (me?.isAdmin || me?.isHost) {
                          setEditingNameId(p.playerId);
                          setEditNameValue(p.name);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: 0,
                        border: "none",
                        background: "none",
                        cursor: (me?.isAdmin || me?.isHost) ? "pointer" : "default",
                        textAlign: "left",
                        fontSize: 18,
                        fontWeight: 700,
                        color: "var(--md-sys-color-on-surface)",
                        textDecoration: "none",
                        letterSpacing: "-0.01em",
                      }}
                      title={(me?.isAdmin || me?.isHost) ? t(lang, "changeNameAdmin") : undefined}
                    >
                      {p.name}
                      {(me?.isAdmin || me?.isHost) && <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--md-sys-color-on-surface-variant)", opacity: 0.6 }}>edit</span>}
                    </button>
                  )}
                  <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                    {p.isHost && <span style={{ fontSize: 13, padding: "4px 8px", background: "var(--md-sys-color-secondary-container)", color: "var(--md-sys-color-on-secondary-container)", borderRadius: "6px", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase" }}>{t(lang, "host")}</span>}
                    {p.isMayor && <span style={{ fontSize: 13, padding: "4px 8px", background: "var(--md-sys-color-tertiary-container)", color: "var(--md-sys-color-on-tertiary-container)", borderRadius: "6px", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase" }}>{t(lang, "mayor")}</span>}
                    {!p.isHost && !p.isMayor && <span style={{ fontSize: 14, fontWeight: 500, color: "var(--md-sys-color-on-surface-variant)" }}>{t(lang, "rolePlayer")}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                  {!p.isHost && (me?.isAdmin || me?.isHost) && (
                    <Button
                      small
                      variant="tonal"
                      onClick={() => emit("admin_set_host", { targetPlayerId: p.playerId })}
                      title={t(lang, "setHostLong")}
                      aria-label={t(lang, "setHostLong") + ": " + p.name}
                      style={{ padding: "8px 16px" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20, marginRight: 4, fontVariationSettings: "'FILL' 1" }}>star</span>
                      {t(lang, "setHost")}
                    </Button>
                  )}
                  {(me?.isHost || me?.isAdmin) && p.playerId !== me?.playerId && !p.isAdmin && (
                    <Button
                      small
                      variant="outlined"
                      onClick={() => emit("host_kick", { targetPlayerId: p.playerId })}
                      style={{ padding: "8px 16px" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20, marginRight: 4 }}>person_remove</span>
                      {t(lang, "kick")}
                    </Button>
                  )}
                  {(me?.isAdmin) && p.playerId !== me?.playerId && !p.isAdmin && (
                    <Button
                      small
                      variant="danger"
                      onClick={() => emit("admin_ban", { targetPlayerId: p.playerId })}
                      style={{ padding: "8px 16px" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20, marginRight: 4 }}>block</span>
                      {t(lang, "ban")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
          </div>
        )}

        {activeTab === "banned" && me?.isAdmin && (
          <div role="tabpanel" id="panel-banned" aria-labelledby="tab-banned">
          <Card style={{ padding: 0 }}>
            {bannedPlayers.length === 0 ? (
              <div style={{ padding: "48px 32px", textAlign: "center", color: "var(--md-sys-color-on-surface-variant)", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 56, opacity: 0.3 }}>sentiment_satisfied</span>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>{t(lang, "noBannedPlayers")}</p>
              </div>
            ) : (
              bannedPlayers.map((p, i) => (
                <div
                  key={p.playerId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                    padding: "20px 24px",
                    borderBottom: i < bannedPlayers.length - 1 ? "1px solid var(--md-sys-color-outline-variant)" : "none",
                  }}
                >
                  <Avatar name={p.name} size={56} style={{ filter: "grayscale(1)" }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px", color: "var(--md-sys-color-on-surface)", letterSpacing: "-0.01em" }}>{p.name}</p>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "var(--md-sys-color-on-surface-variant)", margin: 0 }}>
                      {t(lang, "bannedAt")}: {new Date(p.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    small
                    variant="tonal"
                    onClick={() => emit("admin_unban", { targetPlayerId: p.playerId })}
                    style={{ background: "var(--md-sys-color-secondary-container)", color: "var(--md-sys-color-on-secondary-container)", padding: "8px 16px" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20, marginRight: 4 }}>settings_backup_restore</span>
                    {t(lang, "unban")}
                  </Button>
                </div>
              ))
            )}
          </Card>
          </div>
        )}
      </div>
    </div>
  );
}
