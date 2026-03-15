import { useCallback } from "react";

export const PHRASES = {
  mayor_election: "Bürgermeisterwahl. Bitte wählt eine Person.",
  night: "Die Nacht bricht an. Alle schließen die Augen.",
  werwolf: "Werwölfe, wacht auf. Wählt euer Opfer.",
  seher: "Seherin, wache auf. Wen möchtest du beschauen?",
  hexe: "Hexe, wache auf. Du kannst heilen oder vergiften.",
  day: "Der Tag bricht an. Alle öffnet die Augen.",
};

export function useHostAudio(phase, subPhase, isHost) {
  const speakCurrent = useCallback(() => {
    if (!isHost || typeof window === "undefined" || !window.speechSynthesis) return;
    const toSpeak = subPhase ? PHRASES[subPhase] : PHRASES[phase];
    if (!toSpeak) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(toSpeak);
    u.lang = "de-DE";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }, [phase, subPhase, isHost]);

  return { speakCurrent };
}
