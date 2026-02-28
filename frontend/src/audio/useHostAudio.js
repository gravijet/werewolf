import { useEffect, useRef } from "react";

const PHRASES = {
  mayor_election: "Bürgermeisterwahl. Bitte wählt eine Person.",
  night: "Die Nacht bricht an. Alle schließen die Augen.",
  werwolf: "Werwölfe, wacht auf. Wählt euer Opfer.",
  seher: "Seherin, wache auf. Wen möchtest du beschauen?",
  hexe: "Hexe, wache auf. Du kannst heilen oder vergiften.",
  day: "Der Tag bricht an. Alle öffnet die Augen.",
};

const audioCache = {};

function getSpeechUrl(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  u.rate = 0.9;
  return { u, text };
}

export function useHostAudio(phase, round, subPhase, isHost) {
  const lastRef = useRef({ phase: null, subPhase: null });

  useEffect(() => {
    if (!isHost || typeof window === "undefined" || !window.speechSynthesis) return;

    const key = `${phase}-${subPhase ?? ""}`;
    if (lastRef.current.phase === phase && lastRef.current.subPhase === (subPhase ?? "")) return;
    lastRef.current = { phase, subPhase: subPhase ?? "" };

    const toSpeak = subPhase ? PHRASES[subPhase] : PHRASES[phase];
    if (!toSpeak) return;

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(toSpeak);
    u.lang = "de-DE";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [phase, round, subPhase, isHost]);
}
