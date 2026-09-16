import { supabase, isSupabaseConfigured } from './supabase';
import { TrailRun, SpotGuess, LeaderboardRanking, Trail } from '../types';

const LOCAL_STORAGE_RUNS_PREFIX = 'locateit_trail_runs_';
const LOCAL_STORAGE_COMPLETED_PREFIX = 'locateit_completed_trail_';

/**
 * Checks if this device/browser has already completed a given trail.
 */
export function hasCompletedTrail(trailId: string): boolean {
  try {
    const key = `${LOCAL_STORAGE_COMPLETED_PREFIX}${trailId}`;
    return !!localStorage.getItem(key);
  } catch {
    return false;
  }
}

/**
 * Gets the recorded completed run for this device/browser if available.
 */
export function getCompletedTrailRun(trailId: string): TrailRun | null {
  try {
    const key = `${LOCAL_STORAGE_COMPLETED_PREFIX}${trailId}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Saves a completed trail run to Supabase (and caches in localStorage).
 */
export async function saveTrailRun(runData: {
  trailId: string;
  playerName: string;
  playerColor: string;
  totalDistanceKm: number;
  totalScore: number;
  guesses: SpotGuess[];
  isSolo?: boolean;
}): Promise<{ success: boolean; run?: TrailRun; error?: string }> {
  const newRun: TrailRun = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trailId: runData.trailId,
    playerName: runData.playerName.trim() || 'Explorer',
    playerColor: runData.playerColor,
    totalDistanceKm: runData.totalDistanceKm,
    totalScore: runData.totalScore,
    guesses: runData.guesses,
    createdAt: new Date().toISOString()
  };

  // Save to Supabase if available to obtain official DB ID
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('trail_runs')
        .insert([{
          trail_id: runData.trailId,
          player_name: newRun.playerName,
          player_color: newRun.playerColor,
          total_distance_km: newRun.totalDistanceKm,
          total_score: newRun.totalScore,
          guesses: newRun.guesses
        }])
        .select()
        .single();

      if (!error && data) {
        newRun.id = data.id;
        newRun.createdAt = data.created_at;
      } else if (error) {
        console.warn("Supabase save error (falling back to local cache):", error.message);
      }
    } catch (err: any) {
      console.warn("Network error inserting trail run:", err);
    }
  }

  // Save to local storage after finalizing newRun.id
  try {
    const key = `${LOCAL_STORAGE_RUNS_PREFIX}${runData.trailId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]') as TrailRun[];
    const filtered = existing.filter(r => r.id !== newRun.id);
    filtered.push(newRun);
    localStorage.setItem(key, JSON.stringify(filtered));
    
    // Only mark device as having completed this trail if it was a solo run or active player
    if (runData.isSolo !== false) {
      localStorage.setItem(`locateit_last_run_${runData.trailId}`, newRun.id);
      localStorage.setItem(`${LOCAL_STORAGE_COMPLETED_PREFIX}${runData.trailId}`, JSON.stringify(newRun));
    }
  } catch (e) {
    console.warn("Could not save run to local storage:", e);
  }

  return { success: true, run: newRun };
}

export async function saveTrailRunsBatch(trailId: string, runsData: {
  playerName: string;
  playerColor: string;
  totalDistanceKm: number;
  totalScore: number;
  guesses: SpotGuess[];
}[]): Promise<{ success: boolean; runs: TrailRun[] }> {
  if (!runsData || runsData.length === 0) return { success: true, runs: [] };

  const newRuns: TrailRun[] = runsData.map(r => ({
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trailId,
    playerName: (r.playerName || 'Explorer').trim(),
    playerColor: r.playerColor || '#2563eb',
    totalDistanceKm: r.totalDistanceKm || 0,
    totalScore: r.totalScore || 0,
    guesses: r.guesses || [],
    createdAt: new Date().toISOString()
  }));

  if (isSupabaseConfigured) {
    try {
      const recordsToInsert = newRuns.map(nr => ({
        trail_id: trailId,
        player_name: nr.playerName,
        player_color: nr.playerColor,
        total_distance_km: nr.totalDistanceKm,
        total_score: nr.totalScore,
        guesses: nr.guesses
      }));

      const { data, error } = await supabase
        .from('trail_runs')
        .insert(recordsToInsert)
        .select();

      if (!error && data && data.length > 0) {
        data.forEach((d: any, idx: number) => {
          if (newRuns[idx]) {
            newRuns[idx].id = d.id;
            newRuns[idx].createdAt = d.created_at;
          }
        });
      } else if (error) {
        console.warn("Supabase batch save error (falling back to local cache):", error.message);
      }
    } catch (err) {
      console.warn("Network error batch inserting trail runs:", err);
    }
  }

  // Update local storage
  try {
    const key = `${LOCAL_STORAGE_RUNS_PREFIX}${trailId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]') as TrailRun[];
    const existingIds = new Set(existing.map(e => e.id));
    const merged = [...existing];
    for (const nr of newRuns) {
      if (!existingIds.has(nr.id)) {
        merged.push(nr);
      }
    }
    localStorage.setItem(key, JSON.stringify(merged));
  } catch (e) {
    console.warn("Could not save batch runs to local storage:", e);
  }

  return { success: true, runs: newRuns };
}

/**
 * Loads all completed runs for a given trail from Supabase, merged with local runs.
 */
export async function loadTrailRuns(trailId: string): Promise<TrailRun[]> {
  const localKey = `${LOCAL_STORAGE_RUNS_PREFIX}${trailId}`;
  let localRuns: TrailRun[] = [];
  try {
    localRuns = JSON.parse(localStorage.getItem(localKey) || '[]');
  } catch (e) {
    localRuns = [];
  }

  if (!isSupabaseConfigured) {
    return localRuns;
  }

  try {
    const { data, error } = await supabase
      .from('trail_runs')
      .select('*')
      .eq('trail_id', trailId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("Error fetching trail runs from Supabase:", error.message);
      return localRuns;
    }

    if (data && data.length > 0) {
      const remoteRuns: TrailRun[] = data.map((d: any) => ({
        id: d.id,
        trailId: d.trail_id,
        playerName: d.player_name,
        playerColor: d.player_color,
        totalDistanceKm: Number(d.total_distance_km),
        totalScore: Number(d.total_score),
        guesses: d.guesses || [],
        createdAt: d.created_at
      }));

      // Merge remote and local without duplicate IDs
      const seenIds = new Set(remoteRuns.map(r => r.id));
      const combined = [...remoteRuns];
      for (const lr of localRuns) {
        if (!seenIds.has(lr.id)) {
          combined.push(lr);
        }
      }
      return combined;
    }

    return localRuns;
  } catch (err) {
    console.warn("Failed to load trail runs:", err);
    return localRuns;
  }
}

/**
 * Calculates dual rankings (Total Distance & Relative Points) for all runs in a trail.
 */
export function calculateLeaderboard(runs: TrailRun[], totalQuestions: number): LeaderboardRanking[] {
  if (runs.length === 0) return [];

  // 1. Calculate relative points across all questions
  // For each question spot, find the rank of each player
  const pointsMap = new Map<string, { points: number; spotWins: number }>();
  runs.forEach(r => pointsMap.set(r.id, { points: 0, spotWins: 0 }));

  for (let qIdx = 0; qIdx < totalQuestions; qIdx++) {
    // Collect guesses for this question
    const spotDistances: { runId: string; distanceKm: number }[] = [];
    for (const r of runs) {
      const g = (r.guesses || []).find(guess => guess.questionIndex === qIdx);
      spotDistances.push({
        runId: r.id,
        distanceKm: g !== undefined && typeof g.distanceKm === 'number' && !isNaN(g.distanceKm) ? g.distanceKm : Infinity
      });
    }

    // Sort closest first
    spotDistances.sort((a, b) => a.distanceKm - b.distanceKm);

    // Assign points based on rank
    spotDistances.forEach(sd => {
      const rank = spotDistances.findIndex(s => s.distanceKm === sd.distanceKm);
      const isWinner = rank === 0 && sd.distanceKm < 19000;
      const pts = (sd.distanceKm < 19000) ? Math.max(0, runs.length - rank) : 0;
      
      const current = pointsMap.get(sd.runId);
      if (current) {
        current.points += pts;
        if (isWinner) current.spotWins += 1;
      }
    });
  }

  // 2. Sort by Distance for Distance Rankings
  const sortedByDistance = [...runs].sort((a, b) => (a.totalDistanceKm || 0) - (b.totalDistanceKm || 0));

  // 3. Sort by Points for Point Rankings
  const sortedByPoints = [...runs].sort((a, b) => {
    const ptsA = pointsMap.get(a.id)?.points || 0;
    const ptsB = pointsMap.get(b.id)?.points || 0;
    if (ptsB !== ptsA) return ptsB - ptsA;
    return (a.totalDistanceKm || 0) - (b.totalDistanceKm || 0); // Tie breaker: lowest distance
  });

  // 4. Construct final rankings array
  return runs.map(r => {
    const dRank = sortedByDistance.findIndex(s => s.id === r.id) + 1;
    const pInfo = pointsMap.get(r.id) || { points: 0, spotWins: 0 };
    const pRank = sortedByPoints.findIndex(s => s.id === r.id) + 1;

    return {
      run: r,
      distanceRank: dRank,
      pointRank: pRank,
      calculatedPoints: pInfo.points,
      spotWins: pInfo.spotWins
    };
  });
}
