import React, { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import { GameState, Player, Question, Location, User, AppView, Trail } from './types';
import { generateId, calculateDistance, getOpenTrailCode } from './utils';
import { supabase } from './lib/supabase';
import { useLanguage } from './i18n';
import { gameReducer } from './gameReducer';
import { useGameSync, GameSyncMessage } from './useGameSync';
import { useTrails } from './hooks/useTrails';
import QuizCreator from './components/QuizCreator';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Home from './components/Home';
import JoinGame from './components/JoinGame';
import SoloPlay from './components/SoloPlay';
import TrailLeaderboard from './components/TrailLeaderboard';
import { PermissionModal } from './components/PermissionGate';
import { HowToPlayModal } from './components/HowToPlayModal';
import { clearDraft } from './lib/draftStorage';
import { hasCompletedTrail, saveTrailRun } from './lib/trailRuns';

const fetchTrailByCode = async (searchCode: string): Promise<Trail | null> => {
  try {
    const rawClean = searchCode.trim();
    const { data, error } = await supabase
      .from('trails')
      .select('*, questions (*)')
      .order('created_at', { ascending: false });

    if (error || !data) return null;

    const match = data.find((t: any) => {
      const fullId = t.id.toLowerCase();
      const input = rawClean.toLowerCase();
      const otCode = getOpenTrailCode(t.id).toLowerCase();
      const otCodeNoHyphen = otCode.replace('-', '');
      const shortId = t.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8);
      const inputNoHyphen = input.replace(/[^a-zA-Z0-9]/g, '');

      return (
        fullId === input ||
        otCode === input ||
        otCodeNoHyphen === inputNoHyphen ||
        shortId === inputNoHyphen ||
        (inputNoHyphen.length >= 6 && inputNoHyphen.endsWith(shortId))
      );
    });

    if (!match) return null;

    return {
      id: match.id,
      name: match.name,
      creatorId: match.creator_id,
      lastUpdated: new Date(match.created_at || Date.now()).getTime(),
      startingView: match.starting_view,
      questions: (match.questions || [])
        .sort((a: any, b: any) => (a.position_order || 0) - (b.position_order || 0))
        .map((q: any) => ({
          id: q.id,
          imageUrl: q.image_url,
          location: q.location,
          title: q.title,
          locationSource: q.location_source,
          trailId: q.trail_id
        }))
    };
  } catch (err) {
    console.error("fetchTrailByCode error:", err);
    return null;
  }
};

const viewToHash = (v: AppView, params?: { trailId?: string; code?: string; runId?: string }): string => {
  switch (v) {
    case 'HOME': return '#home';
    case 'JOIN': return params?.code ? `#join?code=${encodeURIComponent(params.code)}` : '#join';
    case 'AUTH': return '#auth';
    case 'DASHBOARD': return '#dashboard';
    case 'CREATE': return params?.trailId ? `#create?trailId=${encodeURIComponent(params.trailId)}` : '#create';
    case 'SOLO_PLAY': return params?.trailId ? `#solo?trailId=${encodeURIComponent(params.trailId)}` : '#solo';
    case 'LEADERBOARD': {
      let h = params?.trailId ? `#leaderboard?trailId=${encodeURIComponent(params.trailId)}` : '#leaderboard';
      if (params?.runId) h += `&runId=${encodeURIComponent(params.runId)}`;
      return h;
    }
    case 'LOBBY': return params?.code ? `#lobby?code=${encodeURIComponent(params.code)}` : '#lobby';
    case 'PLAYING': return params?.code ? `#play?code=${encodeURIComponent(params.code)}` : '#play';
    default: return '#home';
  }
};

const parseHash = (hashStr: string): { view: AppView; trailId?: string; code?: string; runId?: string } => {
  const clean = hashStr.replace(/^#\/?/, '').trim();
  if (!clean || clean === 'home') return { view: 'HOME' };
  
  const [route, queryStr] = clean.split('?');
  const params = new URLSearchParams(queryStr || '');
  const trailId = params.get('trailId') || params.get('trail') || undefined;
  const code = params.get('code') || params.get('join') || undefined;
  const runId = params.get('runId') || undefined;

  switch (route.toLowerCase()) {
    case 'join': return { view: 'JOIN', code };
    case 'auth': return { view: 'AUTH' };
    case 'dashboard': return { view: 'DASHBOARD' };
    case 'create': return { view: 'CREATE', trailId };
    case 'solo': return { view: 'SOLO_PLAY', trailId };
    case 'leaderboard': return { view: 'LEADERBOARD', trailId, runId };
    case 'lobby': return { view: 'LOBBY', code };
    case 'play': return { view: 'PLAYING', code };
    default: return { view: 'HOME' };
  }
};

const App: React.FC = () => {
  const { strings } = useLanguage();
  const [view, setView] = useState<AppView>('HOME');
  const [user, setUser] = useState<User | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [editingTrail, setEditingTrail] = useState<Trail | null>(null);
  const [selectedSoloTrail, setSelectedSoloTrail] = useState<Trail | null>(null);
  const [soloPlayerInfo, setSoloPlayerInfo] = useState<{ name: string; color: string } | null>(null);
  const [activeLeaderboardRunId, setActiveLeaderboardRunId] = useState<string | undefined>(undefined);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showHowToPlayModal, setShowHowToPlayModal] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null); 
  const [isJoining, setIsJoining] = useState(false);
  const [isRejoining, setIsRejoining] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string; type?: 'error' | 'info' } | null>(null);
  
  // Use a ref for sendAction to break the circular dependency with handleExitGame
  const sendActionRef = useRef<((action: GameSyncMessage) => void) | null>(null);
  const joinTimeoutRef = useRef<number | null>(null);
  const prevStatusRef = useRef<GameState['status'] | null>(null);
  const prevIndexRef = useRef<number>(-1);

  const { trails, saveTrail, deleteTrail, isLoading: isTrailsLoading } = useTrails(user);
  const [gameState, dispatch] = useReducer(gameReducer, null);

  // Centralized Navigation helper with Browser History Synchronization
  const navigateTo = useCallback((targetView: AppView, options?: {
    trail?: Trail | null;
    trailId?: string;
    code?: string;
    runId?: string;
    playerInfo?: { name: string; color: string };
    replace?: boolean;
    skipHistory?: boolean;
  }) => {
    const activeTrailId = options?.trailId || options?.trail?.id || selectedSoloTrail?.id;
    const activeCode = options?.code || joinCode || undefined;
    const activeRunId = options?.runId || activeLeaderboardRunId || undefined;

    if (options?.trail !== undefined) setSelectedSoloTrail(options.trail);
    if (options?.code !== undefined) setJoinCode(options.code);
    if (options?.runId !== undefined) setActiveLeaderboardRunId(options.runId);
    if (options?.playerInfo) setSoloPlayerInfo(options.playerInfo);

    setView(targetView);

    if (!options?.skipHistory) {
      const targetHash = viewToHash(targetView, { trailId: activeTrailId, code: activeCode, runId: activeRunId });
      const historyState = { view: targetView, trailId: activeTrailId, code: activeCode, runId: activeRunId };
      
      try {
        if (options?.replace) {
          window.history.replaceState(historyState, document.title, targetHash);
        } else if (window.location.hash !== targetHash) {
          window.history.pushState(historyState, document.title, targetHash);
        }
      } catch (err) {
        console.error("History navigation error:", err);
      }
    }
  }, [selectedSoloTrail?.id, joinCode, activeLeaderboardRunId]);

  // Sync view with game status (for both host and players)
  useEffect(() => {
    if (!gameState) return;
    const isInGameView = view === 'PLAYING';
    const shouldBeInGameView = ['PLAYING', 'RESULTS', 'SCOREBOARD', 'COUNTDOWN', 'FINISHED'].includes(gameState.status);
    
    if (shouldBeInGameView && !isInGameView && (view === 'LOBBY' || view === 'JOIN')) {
      navigateTo('PLAYING', { code: gameState.id, replace: true });
    }
  }, [gameState?.status, gameState?.id, view, navigateTo]);

  // handleExitGame is defined here and uses sendActionRef to avoid "used before declaration" error
  const handleExitGame = useCallback((silent = false, targetView?: AppView) => {
    // 1. Snapshot the player identity and host status before clearing
    const pId = currentPlayer?.id;
    const wasHost = isHost;

    // 2. Clear state immediately to stop watchers and callbacks
    if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
    setCurrentPlayer(null);
    setIsJoining(false);
    setJoinCode(null);
    setIsHost(false);
    prevStatusRef.current = null;
    prevIndexRef.current = -1;

    // 3. Clean up all stored session artifacts
    try {
      localStorage.removeItem('locateit_active_game_code');
      localStorage.removeItem('locateit_active_host_state');
      localStorage.removeItem('locateit_saved_guess');
      localStorage.removeItem('locateit_saved_round');
      localStorage.removeItem('locateit_join_intent');
    } catch {
      // ignore
    }

    // 4. Notify the network via the ref
    if (wasHost) {
      sendActionRef.current?.({ type: 'TERMINATE_SESSION' });
    } else if (pId && !silent) {
      sendActionRef.current?.({ type: 'PLAYER_LEAVE', playerId: pId });
    }

    // 5. Exit game reducer
    dispatch({ type: 'EXIT_GAME' });
    
    // 6. Safely route back:
    const nextView = targetView || (wasHost && user ? 'DASHBOARD' : 'HOME');
    navigateTo(nextView, { replace: true });
  }, [isHost, currentPlayer, user, navigateTo]);

  const { broadcast, sendAction, requestSync, clearCache } = useGameSync(
    useCallback((state) => dispatch({ type: 'SYNC_STATE', payload: state }), []),
    useCallback((action) => dispatch(action), []),
    isHost,
    gameState,
    joinCode,
    useCallback((targetId: string) => {
      // Targeted Kick: only notify if WE are the target
      if (currentPlayer && targetId === currentPlayer.id) {
        setNotification({ title: "Expedition Notice", message: strings.lobby.kickedDesc, type: 'info' });
        handleExitGame(true);
      }
    }, [currentPlayer?.id, handleExitGame, strings.lobby.kickedDesc]),
    useCallback(() => {
      // Session Ended: Host disconnected explicitly
      if (gameState?.status !== 'FINISHED') {
        setNotification({ title: "Expedition Ended", message: "The expedition has been terminated by the host.", type: 'info' });
      }
      handleExitGame(true);
    }, [handleExitGame, gameState?.status])
  );

  // Sync the sendAction function to our ref for handleExitGame to use
  useEffect(() => {
    sendActionRef.current = sendAction;
  }, [sendAction]);

  const handleStartSoloPlay = useCallback((trail: Trail, name: string, color: string) => {
    setSelectedSoloTrail(trail);
    setSoloPlayerInfo({ name, color });
    navigateTo('SOLO_PLAY', { trail, trailId: trail.id, playerInfo: { name, color } });
    try {
      if (!localStorage.getItem('locateit_has_seen_how_to_play')) {
        setShowHowToPlayModal(true);
      }
    } catch {}
  }, [navigateTo]);

  const handleOpenLeaderboard = useCallback((trail: Trail, runId?: string) => {
    setSelectedSoloTrail(trail);
    setActiveLeaderboardRunId(runId);
    navigateTo('LEADERBOARD', { trail, trailId: trail.id, runId });
  }, [navigateTo]);

  const handleResumeHost = useCallback(() => {
    const saved = localStorage.getItem('locateit_active_host_state');
    if (saved) {
      try {
        const state = JSON.parse(saved) as GameState;
        if (state && state.status && state.status !== 'FINISHED') {
          setIsHost(true);
          setCurrentPlayer(null);
          setJoinCode(state.id);
          dispatch({ type: 'SYNC_STATE', payload: state });
          const target = state.status === 'LOBBY' ? 'LOBBY' : 'PLAYING';
          navigateTo(target, { code: state.id, replace: true });
          return;
        }
      } catch (e) {
        console.error("Failed to resume host state:", e);
      }
      localStorage.removeItem('locateit_active_host_state');
    }
  }, [navigateTo]);

  // Handle Browser Back / Forward Button (popstate)
  useEffect(() => {
    const handlePopState = async (event: PopStateEvent) => {
      const parsed = event.state && event.state.view 
        ? (event.state as { view: AppView; trailId?: string; code?: string; runId?: string })
        : parseHash(window.location.hash);

      const targetView = parsed.view;

      // If backing out from active multiplayer game
      if (gameState && (view === 'PLAYING' || view === 'LOBBY') && targetView !== 'PLAYING' && targetView !== 'LOBBY') {
        handleExitGame(false, targetView);
        return;
      }

      if (parsed.code) {
        setJoinCode(parsed.code);
      }

      if (parsed.runId) {
        setActiveLeaderboardRunId(parsed.runId);
      }

      if (parsed.trailId) {
        if (!selectedSoloTrail || selectedSoloTrail.id !== parsed.trailId) {
          const trail = await fetchTrailByCode(parsed.trailId);
          if (trail) {
            setSelectedSoloTrail(trail);
            if (targetView === 'SOLO_PLAY') {
              const savedName = localStorage.getItem('locateit_player_name') || 'Explorer';
              const savedColor = localStorage.getItem('locateit_player_color') || '#2d4239';
              setSoloPlayerInfo({ name: savedName, color: savedColor });
            }
          }
        }
      }

      setView(targetView);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [gameState, view, selectedSoloTrail, handleExitGame]);

  // Initial URL & Session Restoration (Deep links & Refresh Support)
  useEffect(() => {
    const restoreSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const codeFromUrl = params.get('join');
      const soloTrailIdFromUrl = params.get('solo');

      if (codeFromUrl) {
        const cleanCode = codeFromUrl.trim().toUpperCase();
        if (cleanCode.startsWith('OT')) {
          const trail = await fetchTrailByCode(cleanCode);
          if (trail) {
            const savedName = localStorage.getItem('locateit_player_name');
            const savedColor = localStorage.getItem('locateit_player_color') || '#6366f1';
            if (hasCompletedTrail(trail.id)) {
              handleOpenLeaderboard(trail);
            } else if (savedName) {
              handleStartSoloPlay(trail, savedName, savedColor);
            } else {
              setJoinCode(getOpenTrailCode(trail.id));
              navigateTo('JOIN', { code: getOpenTrailCode(trail.id), replace: true });
            }
            return;
          }
        }
        setJoinCode(cleanCode);
        navigateTo('JOIN', { code: cleanCode, replace: true });
        return;
      } else if (soloTrailIdFromUrl) {
        const soloCode = soloTrailIdFromUrl.trim();
        const trail = await fetchTrailByCode(soloCode);
        if (trail) {
          if (hasCompletedTrail(trail.id)) {
            handleOpenLeaderboard(trail);
          } else {
            const savedName = localStorage.getItem('locateit_player_name');
            const savedColor = localStorage.getItem('locateit_player_color') || '#6366f1';
            if (savedName) {
              handleStartSoloPlay(trail, savedName, savedColor);
            } else {
              setJoinCode(getOpenTrailCode(trail.id));
              navigateTo('JOIN', { code: getOpenTrailCode(trail.id), replace: true });
            }
          }
        } else {
          setJoinCode(soloCode.toUpperCase());
          navigateTo('JOIN', { code: soloCode.toUpperCase(), replace: true });
        }
        return;
      }

      // Check current hash on fresh page load or browser refresh
      const parsed = parseHash(window.location.hash);
      
      if (parsed.view === 'SOLO_PLAY' && parsed.trailId) {
        const trail = await fetchTrailByCode(parsed.trailId);
        if (trail) {
          const savedName = localStorage.getItem('locateit_player_name') || 'Explorer';
          const savedColor = localStorage.getItem('locateit_player_color') || '#2d4239';
          setSelectedSoloTrail(trail);
          setSoloPlayerInfo({ name: savedName, color: savedColor });
          setView('SOLO_PLAY');
          return;
        }
      } else if (parsed.view === 'LEADERBOARD' && parsed.trailId) {
        const trail = await fetchTrailByCode(parsed.trailId);
        if (trail) {
          setSelectedSoloTrail(trail);
          setActiveLeaderboardRunId(parsed.runId);
          setView('LEADERBOARD');
          return;
        }
      } else if (parsed.view === 'JOIN') {
        if (parsed.code) setJoinCode(parsed.code);
        setView('JOIN');
        return;
      } else if (parsed.view === 'AUTH') {
        setView('AUTH');
        return;
      } else if (parsed.view === 'CREATE') {
        setView('CREATE');
        return;
      } else if (parsed.view === 'DASHBOARD') {
        setView('DASHBOARD');
        return;
      }
    };

    restoreSession();
  }, [handleOpenLeaderboard, handleStartSoloPlay, navigateTo]);

  // Host: Broadcast changes
  useEffect(() => {
    if (isHost && gameState) {
      // Accidental refresh protection: save host state to local storage ONLY if game is active
      if (gameState.status !== 'FINISHED') {
        localStorage.setItem('locateit_active_host_state', JSON.stringify(gameState));
      } else {
        localStorage.removeItem('locateit_active_host_state');
      }
      
      const isStatusChange = gameState.status !== prevStatusRef.current;
      const isIndexChange = gameState.currentQuestionIndex !== prevIndexRef.current;
      const isNewGame = prevStatusRef.current === null;
      const needsFullSync = isStatusChange || isIndexChange || isNewGame;
      
      broadcast(gameState, needsFullSync);
      
      prevStatusRef.current = gameState.status;
      prevIndexRef.current = gameState.currentQuestionIndex;
    }
  }, [gameState, isHost, broadcast]);

  // Clean up storage and persist leaderboard runs when game is finished
  useEffect(() => {
    if (gameState?.status === 'FINISHED') {
      try {
        localStorage.removeItem('locateit_active_host_state');
        localStorage.removeItem('locateit_active_game_code');
        localStorage.removeItem('locateit_saved_guess');
        localStorage.removeItem('locateit_saved_round');
        localStorage.removeItem('locateit_join_intent');
      } catch {
        // ignore
      }

      // Persist completed player runs to the trail leaderboard if trailId exists
      if (gameState.trailId && Array.isArray(gameState.players)) {
        const trailId = gameState.trailId;
        gameState.players.forEach(p => {
          if (p.name && Array.isArray(p.guesses) && p.guesses.length > 0) {
            const totalDistanceKm = p.guesses.reduce((acc, g) => acc + (g.distanceKm || 0), 0);
            saveTrailRun({
              trailId,
              playerName: p.name,
              playerColor: p.color,
              totalDistanceKm,
              totalScore: p.score || 0,
              guesses: p.guesses
            }).catch(err => {
              console.warn("Could not save live trail run:", err);
            });
          }
        });
      }
    }
  }, [gameState?.status, gameState?.trailId, gameState?.players]);

  // Player: Sync loop when waiting for game data
  useEffect(() => {
    if (view === 'LOBBY' && !isHost && joinCode) {
      const interval = setInterval(requestSync, 4000);
      return () => clearInterval(interval);
    }
  }, [view, isHost, requestSync, joinCode]);

  // Join Watchdog (Purely for the spinner)
  useEffect(() => {
    if (gameState && currentPlayer && !isHost && isJoining) {
      const isPresent = gameState.players.some(p => p.id === currentPlayer.id);
      if (isPresent) {
        setIsJoining(false);
        if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      }
    }
  }, [gameState?.players, currentPlayer, isHost, isJoining]);

  // Auto-rejoin logic for players
  useEffect(() => {
    if (gameState && !isHost && !currentPlayer && (view === 'JOIN' || view === 'LOBBY' || view === 'PLAYING')) {
      const savedId = localStorage.getItem('locateit_last_player_id');
      const savedCode = localStorage.getItem('locateit_active_game_code');
      
      if (savedId && savedCode === gameState.id) {
        const existing = gameState.players.find(p => p.id === savedId);
        if (existing) {
          setCurrentPlayer(existing);
          setIsJoining(false);
          setIsRejoining(false);
          
          const target = gameState.status === 'LOBBY' ? 'LOBBY' : 'PLAYING';
          navigateTo(target, { code: gameState.id, replace: true });
        }
      }
    }
  }, [gameState, isHost, currentPlayer, view, navigateTo]);

  // User Authentication & Session Check
  useEffect(() => {
    const savedUser = localStorage.getItem('locateit_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('locateit_user');
      }
    }
    
    // Also check Supabase active session to ensure user state is retained across refreshes
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .single()
          .then(
            ({ data: profile }) => {
              const restoredUser: User = {
                id: session.user.id,
                username: profile?.username || session.user.email?.split('@')[0] || 'Explorer',
                email: session.user.email,
              };
              setUser(restoredUser);
              localStorage.setItem('locateit_user', JSON.stringify(restoredUser));
            },
            () => {
              const fallbackUser: User = {
                id: session.user.id,
                username: session.user.email?.split('@')[0] || 'Explorer',
                email: session.user.email,
              };
              setUser(fallbackUser);
              localStorage.setItem('locateit_user', JSON.stringify(fallbackUser));
            }
          );
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && _event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem('locateit_user');
      }
    });

    // Check for active player or host session
    const savedCode = localStorage.getItem('locateit_active_game_code');
    const savedHostState = localStorage.getItem('locateit_active_host_state');
    
    if (savedHostState) {
      try {
        const state = JSON.parse(savedHostState) as GameState;
        if (state && state.status && state.status !== 'FINISHED') {
          handleResumeHost();
        } else {
          localStorage.removeItem('locateit_active_host_state');
        }
      } catch {
        localStorage.removeItem('locateit_active_host_state');
      }
    } else if (savedCode) {
      setJoinCode(savedCode);
      setIsRejoining(true);
      navigateTo('JOIN', { code: savedCode, replace: true });
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [handleResumeHost, navigateTo]);

  const handleCompleteTrail = async (
    questions: Question[], 
    name: string, 
    startingView?: { center: Location, zoom: number }
  ) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const cleanEditingId = (editingTrail?.id && editingTrail.id.trim() !== '') ? editingTrail.id : undefined;
      const result = await saveTrail(questions, name, startingView, cleanEditingId);
      if (result.success && result.id) {
        clearDraft(cleanEditingId);
        clearDraft(undefined);
        setEditingTrail(null);
        navigateTo('DASHBOARD');
      } else {
        setNotification({ title: "Save Failed", message: result.error || "Could not save trail.", type: 'error' });
      }
    } catch (e: any) {
      setNotification({ title: "Unexpected Error", message: e.message || "An error occurred.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleHostTrail = (trail: Trail) => {
    if (!user) return;
    setIsHost(true);
    setCurrentPlayer(null); 
    const newGameId = `LT-${generateId()}`;
    dispatch({ 
      type: 'INIT_LOBBY', 
      payload: { 
        id: newGameId, 
        trailId: trail.id,
        questions: trail.questions, 
        hostId: user.id, 
        startingView: trail.startingView 
      } 
    });
    setJoinCode(newGameId);
    navigateTo('LOBBY', { code: newGameId });
  };

  const handleJoinGame = async (gameCode: string, name: string, color: string) => {
    setJoinError(null);
    const code = gameCode.trim().toUpperCase();
    
    // Save player preferences
    localStorage.setItem('locateit_player_name', name);
    localStorage.setItem('locateit_player_color', color);

    // 1. INSTANT OPEN TRAIL BRANCH (Codes starting with OT or OT-)
    if (code.startsWith('OT')) {
      setJoinCode(code);
      setIsJoining(true);
      const trail = await fetchTrailByCode(code);
      setIsJoining(false);
      if (trail) {
        if (hasCompletedTrail(trail.id)) {
          handleOpenLeaderboard(trail);
        } else {
          handleStartSoloPlay(trail, name, color);
        }
      } else {
        setJoinError(`Could not find Open Trail ${code}. Check the code and try again.`);
      }
      return;
    }

    // 2. LIVE PARTY BRANCH (Codes starting with LT or legacy codes)
    requestSync();
    setJoinCode(code);
    setIsJoining(true);

    if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
    joinTimeoutRef.current = window.setTimeout(async () => {
      if (!gameState || gameState.id !== code) {
        try {
          const trail = await fetchTrailByCode(code);
          if (trail) {
            setIsJoining(false);
            if (hasCompletedTrail(trail.id)) {
              handleOpenLeaderboard(trail);
            } else {
              handleStartSoloPlay(trail, name, color);
            }
            return;
          }
        } catch {
          // Fall through to error
        }

        setIsJoining(false);
        setJoinError(`Could not find Expedition ${code}. Check the code and try again.`);
      }
    }, 2500);

    // Store intent to join
    const joinIntent = { name, color, code };
    localStorage.setItem('locateit_join_intent', JSON.stringify(joinIntent));
  };

  // Process join intent when gameState arrives
  useEffect(() => {
    const intentStr = localStorage.getItem('locateit_join_intent');
    if (intentStr && gameState && !isHost && !currentPlayer) {
      try {
        const intent = JSON.parse(intentStr);
        if (intent.code === gameState.id) {
          const savedId = localStorage.getItem('locateit_last_player_id');
          const existingById = gameState.players.find(p => p.id === savedId);
          
          if (existingById) {
            setCurrentPlayer(existingById);
            setIsJoining(false);
            localStorage.removeItem('locateit_join_intent');
            const target = gameState.status === 'LOBBY' ? 'LOBBY' : 'PLAYING';
            navigateTo(target, { code: gameState.id, replace: true });
            return;
          }

          const newPlayer: Player = { id: generateId(), name: intent.name, color: intent.color, score: 0, hasGuessed: false };
          setCurrentPlayer(newPlayer);
          localStorage.setItem('locateit_last_player_id', newPlayer.id);
          localStorage.setItem('locateit_active_game_code', intent.code);
          localStorage.removeItem('locateit_join_intent');
          sendAction({ type: 'PLAYER_JOIN_REQUEST', player: newPlayer });
          const target = gameState.status === 'LOBBY' ? 'LOBBY' : 'PLAYING';
          navigateTo(target, { code: gameState.id, replace: true });
          try {
            if (!localStorage.getItem('locateit_has_seen_how_to_play')) {
              setShowHowToPlayModal(true);
            }
          } catch {}
        }
      } catch (e) {
        console.error("Failed to parse join intent:", e);
        localStorage.removeItem('locateit_join_intent');
      }
    }
  }, [gameState, isHost, currentPlayer, sendAction, navigateTo]);

  // Ensure host receives player registration if dropped
  useEffect(() => {
    if (gameState && currentPlayer && !isHost && (view === 'LOBBY' || view === 'PLAYING')) {
      const isPresent = gameState.players.some(p => p.id === currentPlayer.id);
      if (!isPresent) {
        sendAction({ type: 'PLAYER_JOIN_REQUEST', player: currentPlayer });
      }
    }
  }, [gameState?.players, currentPlayer, isHost, view, sendAction]);

  return (
    <>
      {showHowToPlayModal && <HowToPlayModal onClose={() => setShowHowToPlayModal(false)} />}
      {notification && (
        <div className="fixed top-6 inset-x-0 z-[10000] flex justify-center px-4 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-[#0f1a16] text-white px-6 py-4 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-between gap-4 max-w-md w-full pointer-events-auto">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-[#8c6b4f]">{notification.title}</p>
              <p className="text-sm font-medium mt-0.5 text-white/90">{notification.message}</p>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shrink-0"
            >
              {strings.common.dismiss}
            </button>
          </div>
        </div>
      )}
      {showPermissionModal && <PermissionModal onClose={() => setShowPermissionModal(false)} />}
      {view === 'HOME' && (
        <Home onJoin={() => navigateTo('JOIN')} onDesign={() => user ? navigateTo('DASHBOARD') : navigateTo('AUTH')} />
      )}
      {view === 'JOIN' && (
        <JoinGame 
          prefilledCode={joinCode || ''} 
          onBack={() => { handleExitGame(); navigateTo('HOME'); }} 
          onJoin={handleJoinGame} 
          onCodeChange={setJoinCode} 
          isSearching={isJoining} 
          isRejoining={isRejoining} 
          error={joinError} 
        />
      )}
      {view === 'AUTH' && (
        <Auth 
          onAuthSuccess={(u) => { 
            setUser(u); 
            localStorage.setItem('locateit_user', JSON.stringify(u));
            navigateTo('DASHBOARD'); 
            try {
              if (!localStorage.getItem('locateit_creator_perms_prompted')) {
                setShowPermissionModal(true);
                localStorage.setItem('locateit_creator_perms_prompted', 'true');
              }
            } catch {}
          }} 
          onBack={() => navigateTo('HOME')} 
        />
      )}
      {view === 'DASHBOARD' && (
        user ? (
          <Dashboard 
            user={user} 
            trails={trails}
            isLoading={isTrailsLoading}
            onNewTrail={() => { setEditingTrail(null); navigateTo('CREATE'); }} 
            onEditTrail={(t) => { setEditingTrail(t); navigateTo('CREATE', { trailId: t.id }); }} 
            onHostTrail={handleHostTrail} 
            onSoloPlayTrail={(t) => { setJoinCode(t.id); navigateTo('JOIN', { code: t.id }); }}
            onViewLeaderboard={(t) => handleOpenLeaderboard(t)}
            onDeleteTrail={deleteTrail}
            onLogout={() => { 
              localStorage.removeItem('locateit_user'); 
              supabase.auth.signOut().catch(() => {});
              setUser(null); 
              navigateTo('HOME'); 
            }}
            onResumeHost={localStorage.getItem('locateit_active_host_state') ? handleResumeHost : undefined}
          />
        ) : (
          <Home onJoin={() => navigateTo('JOIN')} onDesign={() => navigateTo('AUTH')} />
        )
      )}
      {view === 'SOLO_PLAY' && (
        selectedSoloTrail && soloPlayerInfo ? (
          <SoloPlay 
            trail={selectedSoloTrail} 
            playerName={soloPlayerInfo.name} 
            playerColor={soloPlayerInfo.color} 
            onFinish={(run) => handleOpenLeaderboard(selectedSoloTrail, run.id)} 
            onExit={() => navigateTo(user ? 'DASHBOARD' : 'HOME')} 
          />
        ) : (
          <Home onJoin={() => navigateTo('JOIN')} onDesign={() => user ? navigateTo('DASHBOARD') : navigateTo('AUTH')} />
        )
      )}
      {view === 'LEADERBOARD' && (
        selectedSoloTrail ? (
          <TrailLeaderboard 
            trail={selectedSoloTrail} 
            currentRunId={activeLeaderboardRunId} 
            onPlayAgain={() => { setJoinCode(selectedSoloTrail.id); navigateTo('JOIN', { code: selectedSoloTrail.id }); }} 
            onExit={() => navigateTo(user ? 'DASHBOARD' : 'HOME')} 
          />
        ) : (
          <Home onJoin={() => navigateTo('JOIN')} onDesign={() => user ? navigateTo('DASHBOARD') : navigateTo('AUTH')} />
        )
      )}
      {view === 'CREATE' && (
        user ? (
          <QuizCreator 
            initialTrail={editingTrail || undefined} 
            onComplete={handleCompleteTrail} 
            onCancel={() => navigateTo('DASHBOARD')} 
            onRequestPermissions={() => setShowPermissionModal(true)}
            isSaving={isSaving}
          />
        ) : (
          <Home onJoin={() => navigateTo('JOIN')} onDesign={() => navigateTo('AUTH')} />
        )
      )}
      {view === 'LOBBY' && (
        gameState ? (
          <Lobby 
            gameState={gameState} 
            isHost={isHost} 
            onStart={() => dispatch({ type: 'SET_STATUS', payload: 'PLAYING' })} 
            currentPlayer={currentPlayer} 
            onBack={() => handleExitGame()} 
            onKick={(id) => {
              sendAction({ type: 'PLAYER_KICKED', targetId: id });
              dispatch({ type: 'KICK_PLAYER', payload: id });
            }} 
          />
        ) : (
          <Home onJoin={() => navigateTo('JOIN')} onDesign={() => user ? navigateTo('DASHBOARD') : navigateTo('AUTH')} />
        )
      )}
      {view === 'PLAYING' && (
        gameState ? (
          <GameBoard 
            gameState={gameState} 
            isHost={isHost} 
            currentPlayer={currentPlayer} 
            onGuess={(guess) => {
              if (!currentPlayer) return;
              const currentQ = gameState.questions[gameState.currentQuestionIndex];
              const dist = calculateDistance(guess, currentQ.location);
              sendAction({ type: 'PLAYER_GUESS_REQUEST', playerId: currentPlayer.id, guess, distance: dist });
              if (isHost) dispatch({ type: 'SUBMIT_GUESS', payload: { playerId: currentPlayer.id, guess, distance: dist } });
            }} 
            onUnlock={() => {
              if (!currentPlayer) return;
              sendAction({ type: 'PLAYER_UNLOCK_REQUEST', playerId: currentPlayer.id });
              if (isHost) dispatch({ type: 'UNLOCK_GUESS', payload: currentPlayer.id });
            }}
            onReveal={() => {
              if (!isHost) return;
              dispatch({ type: 'SET_STATUS', payload: 'COUNTDOWN' });
              sendAction({ type: 'HOST_REVEAL_REQUEST' });
            }}
            onForceReveal={() => {
              if (!isHost) return;
              dispatch({ type: 'FORCE_REVEAL' });
              sendAction({ type: 'FORCE_REVEAL' });
            }}
            onCountdownFinish={() => isHost && dispatch({ type: 'SET_STATUS', payload: 'RESULTS' })}
            onShowScoreboard={() => isHost && dispatch({ type: 'CALCULATE_SCORES' })}
            onNext={() => isHost && dispatch({ type: 'NEXT_ROUND' })} 
            onExit={(targetView) => handleExitGame(false, targetView)}
            onViewLeaderboard={async (trailId) => {
              const trail = await fetchTrailByCode(trailId);
              if (trail) {
                handleOpenLeaderboard(trail);
              }
            }}
          />
        ) : (
          <Home onJoin={() => navigateTo('JOIN')} onDesign={() => user ? navigateTo('DASHBOARD') : navigateTo('AUTH')} />
        )
      )}
    </>
  );
};

export default App;
