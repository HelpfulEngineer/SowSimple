import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallPrompt() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const updateInstalledState = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone ===
          true;
      setIsInstalled(Boolean(standalone));
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    updateInstalledState();
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="label-chip bg-moss/10 text-pine">
        Works offline after first load
      </span>
      {isInstalled ? (
        <span className="label-chip bg-pine text-white">Installed</span>
      ) : null}
      {!isInstalled && installPrompt ? (
        <button
          type="button"
          className="action-button-secondary"
          onClick={handleInstall}
        >
          Install app
        </button>
      ) : null}
    </div>
  );
}
