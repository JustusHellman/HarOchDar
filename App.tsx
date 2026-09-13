
import React, { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import { GameState, Player, Question, Location, User, AppView, Trail } from './types';
import { generateId, calculateDistance } from './utils';
import { useLanguage } from './i18n';
import { gameReducer } from './gameReducer';
import { useGameSync, GameSyncMessage } from './useGameSync';
import { useTrails } from './hooks/useTrails';
import { supabase } from './lib/supabase';
import QuizCreator from './components/QuizCreator';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Home from './components/Home';
import JoinGame from './components/JoinGame';
import SoloPlay from './components/SoloPlay';
import TrailLeaderboard from './components/TrailLeaderboard';
import { SoloStartModal } from './components/SoloStartModal';
import { PermissionModal } from './components/PermissionGate';
import { clearDraft } from './lib/draftStorage';
import { hasCompletedTrail } from './lib/trailRuns';

const App: React.FC = () => {
  const { strings } = useLanguage();
  const [view, setView] = useState<AppView>('HOME');
  const [user, setUser] = useState<User | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [editingTrail, setEditingTrail] = useState<Trail | null>(null);
  const [selectedSoloTrail, setSelectedSoloTrail] = useState<Trail | null>(null);
  const [soloModalTrail, setSoloModalTrail] = useState<Trail | null>(null);
  const [soloPlayerInfo, setSoloPlayerInfo] = useState<{ name: string; color: string } | null>(null);
  const [activeLeaderboardRunId, setActiveLeaderboardRunId] = useState<string | undefined>(undefined);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
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

  // Sync view with game status (for both host and players)
  useEffect(() => {
    if (!gameState) return;
    const isInGameView = view === 'PLAYING';
    const shouldBeInGameView = ['PLAYING', 'RESULTS', 'SCOREBOARD', 'COUNTDOWN', 'FINISHED'].includes(gameState.status);
    
    if (shouldBeInGameView && !isInGameView && (view === 'LOBBY' || view === 'JOIN')) {
      setView('PLAYING');
    }
  }, [gameState?.status, view]);

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
    if (targetView) {
      setView(targetView);
    } else if (wasHost && user) {
      setView('DASHBOARD');
    } else {
      setView('HOME');
    }
  }, [isHost, currentPlayer, user]);

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
    }, [currentPlayer?.id, handleExitGame]),
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

  // Handle Join & Solo Deep Links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('join');
    const soloTrailIdFromUrl = params.get('solo');

    if (codeFromUrl) {
      const cleanCode = codeFromUrl.trim().toUpperCase();
      setJoinCode(cleanCode);
      setView('JOIN');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (soloTrailIdFromUrl) {
      const trailId = soloTrailIdFromUrl.trim().toLowerCase();
      // Fetch trail details to launch solo mode directly
      supabase
        .from('trails')
        .select('*, questions (*)')
        .eq('id', trailId)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            const formattedTrail: Trail = {
              id: data.id,
              name: data.name,
              creatorId: data.creator_id,
              lastUpdated: new Date(data.created_at || Date.now()).getTime(),
              startingView: data.starting_view,
              questions: (data.questions || [])
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
            
            if (hasCompletedTrail(formattedTrail.id)) {
              handleOpenLeaderboard(formattedTrail);
            } else {
              const savedName = localStorage.getItem('locateit_player_name');
              const savedColor = localStorage.getItem('locateit_player_color') || '#6366f1';
              if (savedName) {
                handleStartSoloPlay(formattedTrail, savedName, savedColor);
              } else {
                setSoloModalTrail(formattedTrail);
              }
            }
          }
        });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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

  // Clean up storage when game is finished
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
    }
  }, [gameState?.status]);

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
          
          // Restore guess if it's the same round
          const savedGuess = localStorage.getItem('locateit_saved_guess');
          const savedRound = localStorage.getItem('locateit_saved_round');
          if (savedGuess && savedRound === String(gameState.currentQuestionIndex)) {
            // The PlayerBoard will handle the actual marker display if it's in the gameState
            // but we might need to sync local state if they haven't submitted yet.
          }
          
          setView(gameState.status === 'LOBBY' ? 'LOBBY' : 'PLAYING');
        }
      }
    }
  }, [gameState, isHost, currentPlayer, view]);

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
      setView('JOIN');
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
        setView('DASHBOARD');
      } else {
        setNotification({ title: "Save Failed", message: result.error || "Could not save trail.", type: 'error' });
      }
    } catch (e: any) {
      setNotification({ title: "Unexpected Error", message: e.message || "An error occurred.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartSoloPlay = (trail: Trail, name: string, color: string) => {
    setSelectedSoloTrail(trail);
    setSoloPlayerInfo({ name, color });
    setSoloModalTrail(null);
    setView('SOLO_PLAY');
  };

  const handleOpenLeaderboard = (trail: Trail, runId?: string) => {
    setSelectedSoloTrail(trail);
    setActiveLeaderboardRunId(runId);
    setSoloModalTrail(null);
    setView('LEADERBOARD');
  };

  const handleHostTrail = (trail: Trail) => {
    if (!user) return;
    setIsHost(true);
    setCurrentPlayer(null); 
    const newGameId = generateId();
    dispatch({ type: 'INIT_LOBBY', payload: { id: newGameId, questions: trail.questions, hostId: user.id, startingView: trail.startingView } });
    setJoinCode(newGameId);
    setView('LOBBY');
  };

  const handleResumeHost = () => {
    const saved = localStorage.getItem('locateit_active_host_state');
    if (saved) {
      try {
        const state = JSON.parse(saved) as GameState;
        if (state && state.status && state.status !== 'FINISHED') {
          setIsHost(true);
          setCurrentPlayer(null);
          setJoinCode(state.id);
          dispatch({ type: 'SYNC_STATE', payload: state });
          setView(state.status === 'LOBBY' ? 'LOBBY' : 'PLAYING');
          return;
        }
      } catch (e) {
        console.error("Failed to resume host state:", e);
      }
      localStorage.removeItem('locateit_active_host_state');
    }
  };

  const handleJoinGame = async (gameCode: string, name: string, color: string) => {
    setJoinError(null);
    const code = gameCode.trim().toUpperCase();
    
    // Save player preferences
    localStorage.setItem('locateit_player_name', name);
    localStorage.setItem('locateit_player_color', color);

    // Manual sync request on join attempt for live games
    requestSync();
    setJoinCode(code);
    setIsJoining(true);

    // Watchdog for live game join. If no live game is active, check if this is a valid Trail ID to launch Solo/Leaderboard!
    if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
    joinTimeoutRef.current = window.setTimeout(async () => {
      if (!gameState || gameState.id !== code) {
        // Check if there is a trail matching this ID/code
        try {
          const { data, error } = await supabase
            .from('trails')
            .select('*, questions (*)')
            .eq('id', code.toLowerCase())
            .single();

          if (!error && data) {
            const formattedTrail: Trail = {
              id: data.id,
              name: data.name,
              creatorId: data.creator_id,
              lastUpdated: new Date(data.created_at || Date.now()).getTime(),
              startingView: data.starting_view,
              questions: (data.questions || []).sort((a: any, b: any) => (a.position_order || 0) - (b.position_order || 0)).map((q: any) => ({
                id: q.id,
                imageUrl: q.image_url,
                location: q.location,
                title: q.title,
                locationSource: q.location_source,
                trailId: q.trail_id
              }))
            };

            setIsJoining(false);
            handleStartSoloPlay(formattedTrail, name, color);
            return;
          }
        } catch {
          // Fall through to error
        }

        setIsJoining(false);
        setJoinError(`Could not find Expedition ${code}. Check the code and try again.`);
      }
    }, 2800);

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
            setView(gameState.status === 'LOBBY' ? 'LOBBY' : 'PLAYING');
            return;
          }

          const newPlayer: Player = { id: generateId(), name: intent.name, color: intent.color, score: 0, hasGuessed: false };
          setCurrentPlayer(newPlayer);
          localStorage.setItem('locateit_last_player_id', newPlayer.id);
          localStorage.setItem('locateit_active_game_code', intent.code);
          localStorage.removeItem('locateit_join_intent');
          sendAction({ type: 'PLAYER_JOIN_REQUEST', player: newPlayer });
          setView(gameState.status === 'LOBBY' ? 'LOBBY' : 'PLAYING');
        }
      } catch (e) {
        console.error("Failed to parse join intent:", e);
        localStorage.removeItem('locateit_join_intent');
      }
    }
  }, [gameState, isHost, currentPlayer, sendAction]);

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
        <Home onJoin={() => setView('JOIN')} onDesign={() => user ? setView('DASHBOARD') : setView('AUTH')} />
      )}
      {view === 'JOIN' && (
        <JoinGame 
          prefilledCode={joinCode || ''} 
          onBack={() => { handleExitGame(); setJoinCode(null); }} 
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
            setView('DASHBOARD'); 
          }} 
          onBack={() => setView('HOME')} 
        />
      )}
      {soloModalTrail && (
        <SoloStartModal 
          trail={soloModalTrail} 
          onStart={(name, color) => handleStartSoloPlay(soloModalTrail, name, color)} 
          onViewLeaderboard={() => handleOpenLeaderboard(soloModalTrail)} 
          onClose={() => setSoloModalTrail(null)} 
        />
      )}
      {view === 'DASHBOARD' && (
        user ? (
          <Dashboard 
            user={user} 
            trails={trails}
            isLoading={isTrailsLoading}
            onNewTrail={() => { setEditingTrail(null); setView('CREATE'); }} 
            onEditTrail={(t) => { setEditingTrail(t); setView('CREATE'); }} 
            onHostTrail={handleHostTrail} 
            onSoloPlayTrail={(t) => setSoloModalTrail(t)}
            onViewLeaderboard={(t) => handleOpenLeaderboard(t)}
            onDeleteTrail={deleteTrail}
            onLogout={() => { 
              localStorage.removeItem('locateit_user'); 
              supabase.auth.signOut().catch(() => {});
              setUser(null); 
              setView('HOME'); 
            }}
            onResumeHost={localStorage.getItem('locateit_active_host_state') ? handleResumeHost : undefined}
          />
        ) : (
          <Home onJoin={() => setView('JOIN')} onDesign={() => setView('AUTH')} />
        )
      )}
      {view === 'SOLO_PLAY' && (
        selectedSoloTrail && soloPlayerInfo ? (
          <SoloPlay 
            trail={selectedSoloTrail} 
            playerName={soloPlayerInfo.name} 
            playerColor={soloPlayerInfo.color} 
            onFinish={(run) => handleOpenLeaderboard(selectedSoloTrail, run.id)} 
            onExit={() => setView(user ? 'DASHBOARD' : 'HOME')} 
          />
        ) : (
          <Home onJoin={() => setView('JOIN')} onDesign={() => user ? setView('DASHBOARD') : setView('AUTH')} />
        )
      )}
      {view === 'LEADERBOARD' && (
        selectedSoloTrail ? (
          <TrailLeaderboard 
            trail={selectedSoloTrail} 
            currentRunId={activeLeaderboardRunId} 
            onPlayAgain={() => setSoloModalTrail(selectedSoloTrail)} 
            onExit={() => setView(user ? 'DASHBOARD' : 'HOME')} 
          />
        ) : (
          <Home onJoin={() => setView('JOIN')} onDesign={() => user ? setView('DASHBOARD') : setView('AUTH')} />
        )
      )}
      {view === 'CREATE' && (
        user ? (
          <QuizCreator 
            initialTrail={editingTrail || undefined} 
            onComplete={handleCompleteTrail} 
            onCancel={() => setView('DASHBOARD')} 
            onRequestPermissions={() => setShowPermissionModal(true)}
            isSaving={isSaving}
          />
        ) : (
          <Home onJoin={() => setView('JOIN')} onDesign={() => setView('AUTH')} />
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
          <Home onJoin={() => setView('JOIN')} onDesign={() => user ? setView('DASHBOARD') : setView('AUTH')} />
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
          />
        ) : (
          <Home onJoin={() => setView('JOIN')} onDesign={() => user ? setView('DASHBOARD') : setView('AUTH')} />
        )
      )}
    </>
  );
};

export default App;
