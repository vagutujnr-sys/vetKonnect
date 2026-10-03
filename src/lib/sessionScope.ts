const STAGE_RE = /^[a-z0-9_-]{1,24}$/i;
const APP_PREFIXES = ["vetkonnect:", "vetconnect:"];

function readStage(): string {
  if (typeof window === "undefined") return "";
  try {
    const query = new URLSearchParams(window.location.search).get("stage");
    if (query && STAGE_RE.test(query)) {
      window.name = `vk-${query}`;
      return query;
    }
    if (window.name.startsWith("vk-")) {
      const named = window.name.slice(3);
      if (STAGE_RE.test(named)) return named;
    }
  } catch {
    // Private mode / restricted window.name
  }
  return "";
}

function scopedKey(stage: string, key: string) {
  if (!stage) return key;
  if (key.startsWith("vkstage:")) return key;
  if (APP_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    return `vkstage:${stage}:${key}`;
  }
  return key;
}

/** Isolate owner / vet / admin / council / DVS logins when the app is embedded with ?stage= or window.name. */
export function installPresentationSessionScope() {
  if (typeof window === "undefined") return;
  const stage = readStage();
  if (!stage) return;
  const marker = window as Window & { __vkStageInstalled?: string };
  if (marker.__vkStageInstalled) return;
  marker.__vkStageInstalled = stage;

  const getItem = Storage.prototype.getItem;
  const setItem = Storage.prototype.setItem;
  const removeItem = Storage.prototype.removeItem;

  Storage.prototype.getItem = function scopedGetItem(key: string) {
    return getItem.call(this, scopedKey(stage, key));
  };
  Storage.prototype.setItem = function scopedSetItem(key: string, value: string) {
    return setItem.call(this, scopedKey(stage, key), value);
  };
  Storage.prototype.removeItem = function scopedRemoveItem(key: string) {
    return removeItem.call(this, scopedKey(stage, key));
  };
}

installPresentationSessionScope();
