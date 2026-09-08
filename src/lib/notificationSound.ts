const NOTIFICATION_SOUND_URL = "/sounds/notification.mp3";

let audio: HTMLAudioElement | null = null;
let lastPlayedAt = 0;

function getAudio() {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.preload = "auto";
  }
  return audio;
}

/** Play the app notification chime (respects a short cooldown to avoid spam). */
export function playNotificationSound(options?: { force?: boolean }) {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (!options?.force && now - lastPlayedAt < 1200) return;
  lastPlayedAt = now;

  try {
    const el = getAudio();
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => {
      // Browsers may block audio until a user gesture; ignore quietly.
    });
  } catch {
    // Ignore playback failures
  }
}
