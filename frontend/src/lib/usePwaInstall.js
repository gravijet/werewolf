import { useEffect, useState, useCallback } from "react";

/**
 * Fängt das `beforeinstallprompt`-Event ab (Chrome/Edge/Android) und stellt
 * eine Funktion bereit, um die native „Zum Startbildschirm hinzufügen"-Abfrage
 * auszulösen. Auf Plattformen ohne Unterstützung bleibt canInstall einfach false.
 */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState(null);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {}
    setDeferred(null);
  }, [deferred]);

  return { canInstall: Boolean(deferred), promptInstall };
}
