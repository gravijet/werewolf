import { useCallback } from "react";

export const PHRASES = {
  mayor_election: "Bürgermeisterwahl. Jetzt abstimmen.",
  night: "Nacht. Alle Augen schließen.",
  werwolf: "Werwölfe sind am Zug. Ziel wählen.",
  seher: "Seher ist am Zug. Eine Person prüfen.",
  hexe: "Hexe ist am Zug. Heilen oder vergiften.",
  day: "Tag. Alle Augen öffnen.",
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
