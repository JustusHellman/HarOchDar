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
 * Saves a completed solo trail run to Supabase (and caches in localStorage).
 */
export async function saveTrailRun(runData: {
  trailId: string;
  playerName: string;
  playerColor: string;
  totalDistanceKm: number;
  totalScore: number;
  guesses: SpotGuess[];
}): Promise<{ success: boolean; run?: TrailRun; error?: string }> {
  // Check if player or device already has a recorded run for this trail
  const existingCompleted = getCompletedTrailRun(runData.trailId);
  if (existingCompleted) {
    return { success: true, run: existingCompleted };
  }

  const existingRuns = await loadTrailRuns(runData.trailId);
  const existingPlayerRun = existingRuns.find(
    r => r.playerName.trim().toLowerCase() === runData.playerName.trim().toLowerCase()
  );

  if (existingPlayerRun) {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_COMPLETED_PREFIX}${runData.trailId}`, JSON.stringify(existingPlayerRun));
    } catch {}
    return { success: true, run: existingPlayerRun };
  }

  const newRun: TrailRun = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trailId: runData.trailId,
    playerName: runData.playerName,
    playerColor: runData.playerColor,
    totalDistanceKm: runData.totalDistanceKm,
    totalScore: runData.totalScore,
    guesses: runData.guesses,
    createdAt: new Date().toISOString()
  };

  // Mark trail as completed locally to prevent re-attempts
  try {
    const key = `${LOCAL_STORAGE_RUNS_PREFIX}${runData.trailId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]') as TrailRun[];
    existing.push(newRun);
    localStorage.setItem(key, JSON.stringify(existing));
    localStorage.setItem(`locateit_last_run_${runData.trailId}`, newRun.id);
    localStorage.setItem(`${LOCAL_STORAGE_COMPLETED_PREFIX}${runData.trailId}`, JSON.stringify(newRun));
  } catch (e) {
    console.warn("Could not save run to local storage:", e);
  }

  // Save to Supabase if available
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('trail_runs')
        .insert([{
          trail_id: runData.trailId,
          player_name: runData.playerName,
          player_color: runData.playerColor,
          total_distance_km: runData.totalDistanceKm,
          total_score: runData.totalScore,
          guesses: runData.guesses
        }])
        .select()
        .single();

      if (error) {
        console.warn("Supabase save error (falling back to local cache):", error.message);
        return { success: true, run: newRun };
      }

      if (data) {
        newRun.id = data.id;
        newRun.createdAt = data.created_at;
      }
      return { success: true, run: newRun };
    } catch (err: any) {
      console.warn("Network error inserting trail run:", err);
      return { success: true, run: newRun };
    }
  }

  return { success: true, run: newRun };
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

      // Merge remote and local without duplicates
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
      const g = r.guesses.find(guess => guess.questionIndex === qIdx);
      spotDistances.push({
        runId: r.id,
        distanceKm: g !== undefined ? g.distanceKm : Infinity
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
  const sortedByDistance = [...runs].sort((a, b) => a.totalDistanceKm - b.totalDistanceKm);

  // 3. Sort by Points for Point Rankings
  const sortedByPoints = [...runs].sort((a, b) => {
    const ptsA = pointsMap.get(a.id)?.points || 0;
    const ptsB = pointsMap.get(b.id)?.points || 0;
    if (ptsB !== ptsA) return ptsB - ptsA;
    return a.totalDistanceKm - b.totalDistanceKm; // Tie breaker: lowest distance
  });

  // 4. Construct final rankings array
  return runs.map(r => {
    const dRank = sortedByDistance.findIndex(s => s.totalDistanceKm === r.totalDistanceKm) + 1;
    const pInfo = pointsMap.get(r.id) || { points: 0, spotWins: 0 };
    const pRank = sortedByPoints.findIndex(s => (pointsMap.get(s.id)?.points || 0) === pInfo.points) + 1;

    return {
      run: r,
      distanceRank: dRank,
      pointRank: pRank,
      calculatedPoints: pInfo.points,
      spotWins: pInfo.spotWins
    };
  });
}
