import { Question, Location } from '../types';

export interface TrailDraft {
  trailId?: string;
  name: string;
  questions: Question[];
  startingView?: { center: Location; zoom: number };
  savedAt: number;
}

const DRAFT_PREFIX = 'locateit_trail_draft_';

export const getDraftStorageKey = (trailId?: string): string => {
  return trailId ? `${DRAFT_PREFIX}${trailId}` : `${DRAFT_PREFIX}new`;
};

const pruneOldDrafts = (keepKey?: string): void => {
  try {
    const drafts: { key: string; savedAt: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX) && key !== keepKey) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            drafts.push({ key, savedAt: parsed.savedAt || 0 });
          } catch {
            drafts.push({ key, savedAt: 0 });
          }
        }
      }
    }
    // Sort oldest first and prune all other drafts to free quota
    drafts.sort((a, b) => a.savedAt - b.savedAt);
    for (const d of drafts) {
      localStorage.removeItem(d.key);
    }
  } catch (e) {
    console.warn("Could not prune older drafts:", e);
  }
};

export const saveDraft = (draft: Omit<TrailDraft, 'savedAt'> & { savedAt?: number }): void => {
  try {
    const key = getDraftStorageKey(draft.trailId);
    const fullDraft: TrailDraft = {
      ...draft,
      savedAt: draft.savedAt || Date.now()
    };
    try {
      localStorage.setItem(key, JSON.stringify(fullDraft));
    } catch (storageErr: any) {
      // If quota exceeded, clean up stale drafts and retry once
      if (storageErr?.name === 'QuotaExceededError' || storageErr?.code === 22) {
        pruneOldDrafts(key);
        localStorage.setItem(key, JSON.stringify(fullDraft));
      } else {
        throw storageErr;
      }
    }
  } catch (err) {
    console.warn("Could not save trail draft locally:", err);
  }
};

export const getDraft = (trailId?: string): TrailDraft | null => {
  try {
    const key = getDraftStorageKey(trailId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrailDraft;
    if (parsed && Array.isArray(parsed.questions)) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn("Could not parse trail draft:", err);
    return null;
  }
};

export const clearDraft = (trailId?: string): void => {
  try {
    const key = getDraftStorageKey(trailId);
    localStorage.removeItem(key);
  } catch (err) {
    console.warn("Could not clear trail draft:", err);
  }
};

export const getLatestDraft = (): TrailDraft | null => {
  try {
    let latest: TrailDraft | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as TrailDraft;
            if (parsed && Array.isArray(parsed.questions) && (parsed.questions.length > 0 || (parsed.name && parsed.name.trim() !== ''))) {
              if (!latest || (parsed.savedAt || 0) > (latest.savedAt || 0)) {
                latest = parsed;
              }
            }
          } catch {}
        }
      }
    }
    return latest;
  } catch {
    return null;
  }
};

export const formatDraftTime = (timestamp: number): string => {
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes === 1) return '1 min ago';
  if (diffMinutes < 60) return `${diffMinutes} mins ago`;
  
  const date = new Date(timestamp);
  const isToday = new Date().toDateString() === date.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today at ${timeStr}`;
  
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
};
