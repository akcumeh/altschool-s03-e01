/* Saved (favorited) events, persisted per user in localStorage.
   The backend has no favorites table; this keeps hearts working everywhere
   without a schema change. Keyed by user id so accounts don't bleed into
   each other on a shared browser. */

function key(userId: string) {
  return `ev_saved_${userId}`;
}

export function getSavedIds(userId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isSaved(userId: string, eventId: string): boolean {
  return getSavedIds(userId).includes(eventId);
}

/** Returns the new saved state for the event. */
export function toggleSaved(userId: string, eventId: string): boolean {
  const ids = getSavedIds(userId);
  const idx = ids.indexOf(eventId);
  if (idx >= 0) ids.splice(idx, 1);
  else ids.push(eventId);
  localStorage.setItem(key(userId), JSON.stringify(ids));
  return idx < 0;
}
