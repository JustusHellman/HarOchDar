import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { GameState, Player, Location, Question } from '../types';
import { formatDistance } from '../utils';
import { strings } from '../i18n';
import Map from './Map';
import Scoreboard from './Scoreboard';
import ImageOverlay from './ImageOverlay';

interface PlayerBoardProps {
  gameState: GameState;
  currentPlayer: Player | null;
  currentQ: Question;
  isRoundFinished: boolean;
  isScoreboard: boolean;
  isLastRound: boolean;
  playerMapConfig: { center: Location, zoom: number };
  onGuess: (loc: Location) => void;
  onUnlock: () => void;
  onExitRequest?: () => void;
}

const PlayerBoard: React.FC<PlayerBoardProps> = ({ 
  gameState, 
  currentPlayer, 
  currentQ, 
  isRoundFinished, 
  isScoreboard, 
  isLastRound,
  playerMapConfig,
  onGuess, 
  onUnlock,
  onExitRequest
}) => {
  const [selectedGuess, setSelectedGuess] = useState<Location | null>(null);
  const [isFullscreenImage, setIsFullscreenImage] = useState(false);

  // Restore guess from localStorage on mount
  useEffect(() => {
    const savedGuess = localStorage.getItem('locateit_saved_guess');
    const savedRound = localStorage.getItem('locateit_saved_round');
    if (savedGuess && savedRound === String(gameState.currentQuestionIndex)) {
      setSelectedGuess(JSON.parse(savedGuess));
    }
  }, [gameState.currentQuestionIndex]);

  // Save guess to localStorage when it changes
  const handleSetGuess = useCallback((loc: Location) => {
    setSelectedGuess(loc);
    localStorage.setItem('locateit_saved_guess', JSON.stringify(loc));
    localStorage.setItem('locateit_saved_round', String(gameState.currentQuestionIndex));
  }, [gameState.currentQuestionIndex]);

  // Clear local marker when the round changes
  useEffect(() => {
    // Only clear if it's a new round
    const savedRound = localStorage.getItem('locateit_saved_round');
    if (savedRound !== String(gameState.currentQuestionIndex)) {
      setSelectedGuess(null);
      localStorage.removeItem('locateit_saved_guess');
    }
  }, [gameState.currentQuestionIndex]);

  const matchingPlayer = gameState.players.find(p => p.id === currentPlayer?.id);
  const hasSubmitted = !!matchingPlayer?.hasGuessed;
  const currentTotalScore = matchingPlayer?.score || 0;

  const handleUnlock = useCallback(() => {
    if (matchingPlayer?.lastGuess) {
      setSelectedGuess(matchingPlayer.lastGuess);
    }
    onUnlock();
  }, [matchingPlayer?.lastGuess, onUnlock]);

  const markers = useMemo(() => isRoundFinished ? [
    { position: currentQ.location, label: strings.game.actualLocation, icon: 'target' as const },
    ...gameState.players.filter(p => p.lastGuess).map(p => ({ 
      position: p.lastGuess!, 
      label: p.id === currentPlayer?.id ? strings.game.yourGuess : strings.game.playerGuessLabel(p.name), 
      icon: 'user' as const, 
      color: p.color 
    }))
  ] : [
    ...(hasSubmitted && matchingPlayer?.lastGuess ? [{ position: matchingPlayer.lastGuess, label: strings.game.yourGuess, icon: 'user' as const, color: currentPlayer?.color }] : []),
    ...(!hasSubmitted && selectedGuess ? [{ position: selectedGuess, label: strings.game.yourGuess, icon: 'user' as const, color: currentPlayer?.color }] : [])
  ], [isRoundFinished, currentQ.location, gameState.players, currentPlayer, hasSubmitted, matchingPlayer, selectedGuess]);

  const lines = useMemo(() => isRoundFinished ? gameState.players.filter(p => p.lastGuess).map(p => ({ 
    from: p.lastGuess!, 
    to: currentQ.location, 
    color: p.color 
  })) : [], [isRoundFinished, gameState.players, currentQ.location]);

  const sortedPlayers = useMemo(() => {
    return [...gameState.players].sort((a, b) => {
      if (a.hasGuessed && b.hasGuessed) {
        const distA = a.lastDistance !== undefined ? a.lastDistance : Infinity;
        const distB = b.lastDistance !== undefined ? b.lastDistance : Infinity;
        return distA - distB;
      }
      if (a.hasGuessed) return -1;
      if (b.hasGuessed) return 1;
      return 0;
    });
  }, [gameState.players]);

  return (
    <div className="h-screen flex flex-col bg-[#f9fbfa] overflow-hidden selection:bg-[#8c6b4f]/20">
      <div className="bg-white/70 backdrop-blur-xl rounded-b-[2rem] p-5 shadow-sm border-b border-[#2d4239]/5 flex justify-between items-center z-[100] shrink-0">
          <div className="flex items-center space-x-4">
            <button 
              onClick={onExitRequest}
              className="p-2 -ml-2 text-[#0f1a16]/20 hover:text-red-500 transition-colors"
              title={strings.lobby.exitTitle}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
            <div className="font-black text-[10px] uppercase tracking-[0.4em] text-[#8c6b4f]">{strings.game.locationCounter(gameState.currentQuestionIndex + 1, gameState.questions.length)}</div>
          </div>
          <div className="flex items-center space-x-6">
             <div className="flex -space-x-3">
                {gameState.players.map(p => (
                  <div key={p.id} className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-sm transition-all ${p.hasGuessed ? 'scale-110 opacity-100 ring-4 ring-[#10b981]/20' : 'scale-90 opacity-20'}`} style={{ backgroundColor: p.color }}>
                    {(p.name || '?').charAt(0).toUpperCase()}
                  </div>
                ))}
             </div>
             <div className="font-black text-[#2d4239] text-sm uppercase tracking-tight tabular-nums">{strings.game.points(currentTotalScore)}</div>
          </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        {isScoreboard ? (
          <div className="absolute inset-0 z-[200] p-6 bg-[#f9fbfa] animate-in slide-in-from-bottom duration-1000 overflow-hidden flex flex-col">
            <Scoreboard players={gameState.players} isLastRound={isLastRound} onAnimationComplete={() => {}} />
          </div>
        ) : (
          <>
            <div className={`w-full flex flex-col p-6 pb-2 space-y-4 overflow-hidden shrink-0 ${isRoundFinished ? 'h-1/2' : 'h-[40%]'}`}>
              {isRoundFinished ? (
                <div className="flex-1 flex flex-col items-center justify-start text-center text-[#0f1a16] overflow-hidden animate-in fade-in duration-700">
                  <h2 className="text-xl font-black py-4 uppercase tracking-tight text-[#0f1a16] shrink-0">{strings.game.roundResults}</h2>
                  <div className="flex-1 w-full overflow-y-auto px-2 pb-6 scroll-smooth-touch">
                    <div className="space-y-3 w-full max-w-sm mx-auto">
                      {sortedPlayers.map(p => (
                        <div key={p.id} className="flex justify-between items-center bg-white p-4 rounded-[1.5rem] border border-[#2d4239]/5 shadow-sm">
                          <div className="flex items-center space-x-4">
                            <div className="w-4 h-4 rounded-[0.4rem] shadow-sm" style={{ backgroundColor: p.color }} />
                            <span className="font-black uppercase tracking-tight text-[10px] text-[#0f1a16]">{p.name}</span>
                          </div>
                          <span className="font-bold text-[10px] tracking-widest text-[#8c6b4f]">{p.lastDistance !== undefined && p.lastDistance < 19000 ? formatDistance(p.lastDistance) : strings.game.noGuess}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 relative rounded-[3rem] overflow-hidden bg-white/40 backdrop-blur-xl border border-white shadow-2xl group">
                  <img src={currentQ.imageUrl} className="w-full h-full object-contain transition-transform duration-[15s] group-hover:scale-105" alt="Spot" />
                  <button onClick={() => setIsFullscreenImage(true)} className="absolute top-4 right-4 bg-[#0f1a16] text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all z-10 border border-white/10">{strings.common.expand}</button>
                </div>
              )}
            </div>

            <div className={`w-full p-6 pt-2 flex flex-col space-y-4 shrink-0 ${isRoundFinished ? 'h-1/2' : 'h-[60%]'}`}>
              <div className="flex-1 relative bg-white rounded-[3rem] shadow-[0_40px_80px_-20px_rgba(45,66,57,0.1)] border border-[#2d4239]/5 overflow-hidden transition-all">
                <Map 
                  key={gameState.currentQuestionIndex}
                  onLocationSelect={isRoundFinished || hasSubmitted ? undefined : handleSetGuess}
                  markers={markers}
                  lines={lines}
                  center={playerMapConfig.center}
                  zoom={playerMapConfig.zoom}
                  roundIndex={gameState.currentQuestionIndex}
                />

                {!isRoundFinished && !hasSubmitted && (
                  <div className="absolute bottom-6 inset-x-0 flex justify-center px-6 z-[1600]">
                    <button 
                      disabled={!selectedGuess} 
                      onClick={() => selectedGuess && onGuess(selectedGuess)} 
                      style={{ backgroundColor: selectedGuess ? (currentPlayer?.color || '#2d4239') : undefined }} 
                      className={`px-8 py-3 btn-sleek !text-[10px] !tracking-[0.1em] shadow-2xl transition-all active:scale-95 ${selectedGuess ? 'text-white' : 'bg-white/80 text-[#0f1a16]/10 shadow-none cursor-not-allowed border border-black/5'}`}
                    >
                      {strings.game.submitGuess}
                    </button>
                  </div>
                )}

                {!isRoundFinished && hasSubmitted && (
                   <div className="absolute bottom-6 inset-x-0 flex flex-col items-center justify-center px-6 z-[1600] space-y-2">
                     <div className="bg-white/95 backdrop-blur-xl shadow-2xl px-6 py-3 rounded-[1.5rem] border border-[#2d4239]/10 flex items-center space-x-3">
                       <div className="w-3.5 h-3.5 bg-[#10b981] rounded-full flex items-center justify-center text-white shadow-lg"><svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg></div>
                       <span className="font-black text-[8px] uppercase tracking-[0.2em] text-[#0f1a16]">{strings.game.waitingHost}</span>
                     </div>
                     <button onClick={handleUnlock} className="bg-white/60 hover:bg-white text-[7px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg transition-all border border-black/5">{strings.game.unlockGuess}</button>
                   </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {isFullscreenImage && (
        <ImageOverlay 
          imageUrl={currentQ.imageUrl} 
          title={isRoundFinished ? (currentQ.title || strings.creator.spotPlaceholder(gameState.currentQuestionIndex + 1)) : strings.creator.spotPlaceholder(gameState.currentQuestionIndex + 1)} 
          onClose={() => setIsFullscreenImage(false)} 
        />
      )}
    </div>
  );
};

export default PlayerBoard;