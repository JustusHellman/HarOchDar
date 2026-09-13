import React, { useState, useEffect, useMemo } from 'react';
import { GameState, Player, Location } from '../types';
import { strings } from '../i18n';
import HostBoard from './HostBoard';
import PlayerBoard from './PlayerBoard';

interface GameBoardProps {
  gameState: GameState;
  isHost: boolean;
  currentPlayer: Player | null;
  onGuess: (loc: Location) => void;
  onUnlock: () => void;
  onReveal?: () => void;
  onForceReveal?: () => void;
  onCountdownFinish: () => void;
  onShowScoreboard: () => void;
  onNext: () => void;
  onExit: (targetView?: 'HOME' | 'DASHBOARD') => void;
}

const isValidLoc = (loc?: Location): boolean => 
  !!loc && typeof loc.lat === 'number' && !isNaN(loc.lat) && typeof loc.lng === 'number' && !isNaN(loc.lng);

const GameBoard: React.FC<GameBoardProps> = ({ 
  gameState, 
  isHost, 
  currentPlayer, 
  onGuess, 
  onUnlock,
  onReveal,
  onForceReveal,
  onCountdownFinish, 
  onShowScoreboard,
  onNext, 
  onExit 
}) => {
  const [canProceed, setCanProceed] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  
  const currentQ = gameState.questions[gameState.currentQuestionIndex];
  const isCountingDown = gameState.status === 'COUNTDOWN';
  const isRoundFinished = gameState.status === 'RESULTS';
  const isScoreboard = gameState.status === 'SCOREBOARD';
  const isGameFinished = gameState.status === 'FINISHED';
  const isLastRound = gameState.currentQuestionIndex === gameState.questions.length - 1;

  const playerMapConfig = useMemo(() => {
    // Explicit user-defined view
    if (gameState.startingView && isValidLoc(gameState.startingView.center)) return gameState.startingView;
    
    // Auto-calculate view based on markers
    const validQuestions = (gameState.questions || []).filter(q => isValidLoc(q.location));
    if (validQuestions.length === 0) return { center: { lat: 59.3293, lng: 18.0686 }, zoom: 12 };

    const lats = validQuestions.map(q => q.location.lat);
    const lngs = validQuestions.map(q => q.location.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
    
    // Improved dynamic zoom calculation
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);
    
    let zoom = 13;
    if (maxDiff > 0) {
      // Basic log-based zoom calculation to fit the extent
      zoom = Math.floor(Math.log2(360 / maxDiff)) - 1;
      // Clamp between sensible limits (from continental down to local neighborhood)
      zoom = Math.max(3, Math.min(zoom, 16));
    } else {
      zoom = 15;
    }

    return { center, zoom };
  }, [gameState.startingView, gameState.questions]);

  useEffect(() => {
    if (isCountingDown) {
      setCountdownValue(3);
    }
  }, [isCountingDown]);

  useEffect(() => {
    if (isCountingDown) {
      if (countdownValue > 0) {
        const timer = window.setTimeout(() => setCountdownValue(v => v - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        onCountdownFinish();
      }
    }
  }, [isCountingDown, countdownValue, onCountdownFinish]);

  useEffect(() => {
    setCountdownValue(3);
    setCanProceed(false);
  }, [gameState.currentQuestionIndex]);

  if (isGameFinished) {
    return (
      <div className="min-h-screen bg-[#f9fbfa] p-4 sm:p-6 flex flex-col items-center justify-center text-[#0f1a16] overflow-y-auto">
        <h1 className="text-3xl sm:text-4xl font-black mb-6 sm:mb-10 uppercase tracking-tight text-[#0f1a16] text-center">{strings.game.expeditionComplete}</h1>
        <div className="bg-white rounded-[2.5rem] sm:rounded-[3.5rem] p-6 sm:p-10 shadow-[0_60px_100px_-20px_rgba(45,66,57,0.15)] w-full max-w-md border border-[#2d4239]/10 flex flex-col max-h-[75vh]">
          <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1 scroll-smooth-touch">
            {[...gameState.players].sort((a,b) => b.score - a.score).map((p, idx) => (
              <div key={p.id} className={`flex items-center justify-between p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] transition-all border ${idx === 0 ? 'bg-[#ca8a04]/5 border-[#ca8a04]/20 shadow-lg scale-102' : 'bg-[#f9fbfa] border-black/5'}`}>
                <div className="flex items-center space-x-4 sm:space-x-5">
                  <div className={`text-xl sm:text-2xl font-black ${idx === 0 ? 'text-[#ca8a04]' : 'opacity-10'}`}>#{idx + 1}</div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[1rem] sm:rounded-[1.25rem] flex items-center justify-center font-black text-white shadow-md border-2 border-white/20 shrink-0" style={{ backgroundColor: p.color }}>
                    {(p.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="font-black uppercase tracking-tight text-xs sm:text-sm text-[#0f1a16] truncate max-w-[150px]">{p.name}</div>
                </div>
                <div className="text-base sm:text-lg font-black text-[#2d4239] tracking-tight shrink-0">{strings.game.points(p.score)}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 mt-6 shrink-0">
            <button 
              onClick={() => onExit(isHost ? 'DASHBOARD' : 'HOME')} 
              className="w-full btn-sleek btn-sleek-pine !bg-[#2d4239] !py-4 shadow-lg text-xs sm:text-sm font-black uppercase tracking-wider"
            >
              {isHost ? strings.game.exitToDashboard : strings.game.playAgain}
            </button>
            {isHost && (
              <button 
                onClick={() => onExit('HOME')} 
                className="w-full py-3 bg-[#f9fbfa] text-[#0f1a16]/60 hover:text-[#0f1a16] rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-black/5 transition-all"
              >
                {strings.common.home}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!currentQ) {
    return (
      <div className="min-h-screen bg-[#f9fbfa] flex flex-col items-center justify-center p-6 text-center text-[#0f1a16]">
        <div className="w-16 h-16 bg-[#7c2d12]/10 text-[#7c2d12] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-black uppercase tracking-tight mb-2">{strings.game.locationNotFound}</h2>
        <p className="text-[#0f1a16]/50 text-sm mb-6 max-w-xs">{strings.game.locationNotFoundDesc}</p>
        <button onClick={() => onExit()} className="btn-sleek btn-sleek-pine !bg-[#2d4239] px-6 py-3 text-xs uppercase font-black">
          {isHost ? strings.game.returnToDashboard : strings.game.returnToHome}
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#f9fbfa] overflow-hidden relative">
      {/* Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[3000] bg-[#0f1a16]/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-xs w-full shadow-2xl border border-black/5 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black mb-2 uppercase tracking-tight text-[#0f1a16]">
              {isHost ? strings.lobby.terminateTitle : strings.lobby.exitTitle}
            </h3>
            <p className="text-[#2d4239]/60 text-sm font-medium mb-8 leading-relaxed">
              {isHost 
                ? strings.lobby.terminateDesc 
                : strings.lobby.exitDesc}
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => onExit()}
                className="w-full py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-red-500/20 hover:bg-red-600 transition-colors"
              >
                {isHost ? strings.lobby.terminateBtn : strings.lobby.exitBtn}
              </button>
              <button 
                onClick={() => setShowExitConfirm(false)}
                className="w-full py-4 bg-[#f9fbfa] text-[#0f1a16]/40 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white transition-colors"
              >
                {strings.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCountingDown && (
        <div className="fixed inset-0 z-[2500] bg-[#0f1a16]/95 backdrop-blur-3xl flex flex-col items-center justify-center text-white animate-in fade-in duration-500">
           <p className="text-white/40 font-black uppercase tracking-[1em] text-[10px] mb-8">{strings.game.countdownTitle}</p>
           <div className="text-[12rem] font-black animate-bounce tracking-tighter">{countdownValue}</div>
        </div>
      )}

      {isHost ? (
        <HostBoard 
          gameState={gameState} 
          currentQ={currentQ} 
          isRoundFinished={isRoundFinished} 
          isScoreboard={isScoreboard} 
          isLastRound={isLastRound}
          canProceed={canProceed}
          onReveal={onReveal}
          onForceReveal={onForceReveal}
          onShowScoreboard={onShowScoreboard}
          onNext={onNext}
          onSetCanProceed={setCanProceed}
          onExitRequest={() => setShowExitConfirm(true)}
        />
      ) : (
        <PlayerBoard 
          gameState={gameState} 
          currentPlayer={currentPlayer} 
          currentQ={currentQ} 
          isRoundFinished={isRoundFinished} 
          isScoreboard={isScoreboard} 
          isLastRound={isLastRound}
          playerMapConfig={playerMapConfig}
          onGuess={onGuess}
          onUnlock={onUnlock}
          onExitRequest={() => setShowExitConfirm(true)}
        />
      )}
      <style>{` .leaflet-control-container { display: ${isCountingDown ? 'none' : 'block'} !important; z-index: 500; } `}</style>
    </div>
  );
};

export default GameBoard;