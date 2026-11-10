const CHECK_INTERVAL = 60_000;

export function setupServiceWorker(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;

  const base = import.meta.env.BASE_URL;
  let hasController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hasController) {
      hasController = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  const start = async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        `${base}sw.js`,
        { scope: base, updateViaCache: 'none' },
      );

      const check = () => {
        if (document.visibilityState !== 'visible') return;
        registration.update().catch(() => {});
      };

      window.setInterval(check, CHECK_INTERVAL);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('focus', check);
      window.addEventListener('online', check);
    } catch {
      // The app still works online if service workers are unavailable.
    }
  };

  if (document.readyState === 'complete') {
    void start();
  } else {
    window.addEventListener('load', () => void start(), { once: true });
  }
}
