import { useCallback } from "react";

/** Sprachanweisungen für die Spielleitung pro Sprache. */
export const PHRASES = {
  de: {
    mayor_election: "Bürgermeisterwahl. Jetzt abstimmen.",
    night: "Die Nacht beginnt. Alle Augen schließen.",
    amor: "Amor erwacht und wählt das Liebespaar.",
    beschuetzer: "Der Beschützer erwacht und nimmt eine Person in Schutz.",
    werwolf: "Die Werwölfe erwachen und wählen ihr Opfer.",
    seher: "Die Seherin erwacht und prüft eine Person.",
    hexe: "Die Hexe erwacht. Heilen oder vergiften.",
    baecker: "Der Bäcker erwacht und wählt eine Person.",
    day: "Der Tag bricht an. Alle Augen öffnen.",
  },
  en: {
    mayor_election: "Mayor election. Cast your votes.",
    night: "Night falls. Everyone, close your eyes.",
    amor: "Cupid awakes and chooses the lovers.",
    beschuetzer: "The guardian awakes and shields a person.",
    werwolf: "The werewolves awake and choose their victim.",
    seher: "The seer awakes and inspects a person.",
    hexe: "The witch awakes. Heal or poison.",
    baecker: "The baker awakes and chooses a person.",
    day: "Day breaks. Everyone, open your eyes.",
  },
  sv: {
    mayor_election: "Borgmästarval. Rösta nu.",
    night: "Natten faller. Alla blundar.",
    amor: "Amor vaknar och väljer de älskande.",
    beschuetzer: "Beskyddaren vaknar och skyddar en person.",
    werwolf: "Varulvarna vaknar och väljer sitt offer.",
    seher: "Siaren vaknar och granskar en person.",
    hexe: "Häxan vaknar. Hela eller förgifta.",
    baecker: "Bagaren vaknar och väljer en person.",
    day: "Dagen gryr. Alla öppnar ögonen.",
  },
};

const LANG_TAGS = { de: "de-DE", en: "en-US", sv: "sv-SE" };

export function useHostAudio(phase, subPhase, isHost, lang = "de") {
  const speakCurrent = useCallback(() => {
    if (!isHost || typeof window === "undefined" || !window.speechSynthesis) return;
    const dict = PHRASES[lang] || PHRASES.de;
    const toSpeak = (subPhase && dict[subPhase]) || dict[phase];
    if (!toSpeak) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(toSpeak);
    const tag = LANG_TAGS[lang] || "de-DE";
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang === tag) || voices.find((v) => v.lang?.startsWith(lang));
    if (voice) u.voice = voice;
    u.lang = tag;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }, [phase, subPhase, isHost, lang]);

  return { speakCurrent };
}
