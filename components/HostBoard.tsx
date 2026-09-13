import React, { useState } from 'react';
import { GameState, Question } from '../types';
import { formatDistance } from '../utils';
import { strings } from '../i18n';
import Map from './Map';
import Scoreboard from './Scoreboard';
import ImageOverlay from './ImageOverlay';

interface HostBoardProps {
  gameState: GameState;
  currentQ: Question;
  isRoundFinished: boolean;
  isScoreboard: boolean;
  isLastRound: boolean;
  canProceed: boolean;
  onReveal?: () => void;
  onForceReveal?: () => void;
  onShowScoreboard: () => void;
  onNext: () => void;
  onSetCanProceed: (can: boolean) => void;
  onExitRequest?: () => void;
}

const HostBoard: React.FC<HostBoardProps> = ({ 
  gameState, 
  currentQ, 
  isRoundFinished, 
  isScoreboard, 
  isLastRound,
  canProceed,
  onReveal, 
  onForceReveal, 
  onShowScoreboard, 
  onNext,
  onSetCanProceed,
  onExitRequest
}) => {
  const [isFullscreenImage, setIsFullscreenImage] = useState(false);
  const [showForceConfirm, setShowForceConfirm] = useState(false);

  const markers = [
    { position: currentQ.location, label: strings.game.actualLocation, icon: 'target' as const },
    ...gameState.players.filter(p => p.hasGuessed && p.lastGuess).map(p => ({
      position: p.lastGuess!,
      label: p.name,
      color: p.color,
      icon: 'user' as const
    }))
  ];

  const lines = gameState.players.filter(p => p.lastGuess).map(p => ({ 
    from: p.lastGuess!, 
    to: currentQ.location, 
    color: p.color 
  }));

  const nonGuessedNames = gameState.players.filter(p => !p.hasGuessed).map(p => p.name).join(', ');

  const sortedPlayers = [...gameState.players].sort((a, b) => {
    if (a.hasGuessed && b.hasGuessed) {
      const distA = a.lastDistance !== undefined ? a.lastDistance : Infinity;
      const distB = b.lastDistance !== undefined ? b.lastDistance : Infinity;
      return distA - distB;
    }
    if (a.hasGuessed) return -1;
    if (b.hasGuessed) return 1;
    return 0;
  });

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#f9fbfa] overflow-hidden">
      {showForceConfirm && (
        <div className="fixed inset-0 z-[3000] bg-[#0f1a16]/40 backdrop-blur-md flex items-center justify-center p-6 text-center">
          <div className="bg-white p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] w-full max-w-sm shadow-2xl border border-black/5 animate-in zoom-in duration-300">
            <h3 className="text-xl font-black mb-4 uppercase tracking-tight">{strings.game.revealResultsConfirmTitle}</h3>
            <p className="text-[#0f1a16]/60 text-sm mb-8 font-medium">
              {strings.game.revealResultsConfirmDesc(nonGuessedNames)}
            </p>
            <div className="flex gap-4">
              <button onClick={() => setShowForceConfirm(false)} className="flex-1 py-4 bg-[#f9fbfa] rounded-2xl font-bold text-xs uppercase tracking-widest transition-all hover:bg-black/5">{strings.common.wait}</button>
              <button onClick={() => { setShowForceConfirm(false); onForceReveal?.(); }} className="flex-1 py-4 bg-[#7c2d12] text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all hover:opacity-90">{strings.game.revealNow}</button>
            </div>
          </div>
        </div>
      )}

      {/* Host Control Panel / Sidebar */}
      <div className="w-full md:w-80 lg:w-96 h-[46%] md:h-full bg-white border-b md:border-b-0 md:border-r border-[#2d4239]/5 flex flex-col overflow-hidden z-20 shrink-0 shadow-md md:shadow-none">
        {/* Header */}
        <div className="px-4 md:px-6 py-3 md:py-5 border-b border-black/5 shrink-0 bg-white">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#8c6b4f]">
                {strings.lobby.host}
              </span>
              <span className="text-[10px] font-bold text-[#0f1a16]/40 tracking-wider">
                #{gameState.id}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {/* Mobile compact photo thumbnail */}
              <button
                onClick={() => setIsFullscreenImage(true)}
                className="md:hidden flex items-center space-x-1.5 px-2 py-1 bg-[#f9fbfa] border border-black/5 rounded-xl text-[9px] font-black uppercase tracking-wider text-[#2d4239] hover:bg-black/5 active:scale-95 transition-all"
                title={strings.game.viewSpotPhoto}
              >
                <img src={currentQ.imageUrl} className="w-5 h-5 rounded-md object-cover border border-black/10" alt="Spot" />
                <span>{strings.game.photo}</span>
              </button>

              <button 
                onClick={onExitRequest}
                className="p-1.5 text-[#0f1a16]/30 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                title={strings.lobby.terminateTitle}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight text-[#0f1a16]">
              {isRoundFinished ? strings.game.roundResults : isScoreboard ? strings.game.standings : strings.game.inProgress}
            </h2>
            <span className="text-[10px] font-black text-[#8c6b4f] uppercase tracking-wider">
              {strings.game.locationCounter(gameState.currentQuestionIndex + 1, gameState.questions.length)}
            </span>
          </div>
        </div>

        {/* Players List - Dedicated Scrollable Container */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-2.5 space-y-2 scroll-smooth-touch">
          <div className="flex items-center justify-between py-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-[#0f1a16]/40">
              {strings.lobby.playersJoined(gameState.players.length)}
            </label>
            {!isRoundFinished && !isScoreboard && (
              <span className="text-[9px] font-black tracking-wider text-[#10b981]">
                {strings.game.lockedInCount(gameState.players.filter(p => p.hasGuessed).length, gameState.players.length)}
              </span>
            )}
          </div>

          {sortedPlayers.map(p => (
            <div key={p.id} className="p-3 md:p-3.5 bg-[#f9fbfa] rounded-2xl border border-black/5 flex items-center justify-between space-x-3 transition-all">
              <div className="flex items-center space-x-3 overflow-hidden flex-1">
                <div 
                  className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center font-black text-white text-xs shrink-0 shadow-sm" 
                  style={{ backgroundColor: p.color }}
                >
                  {(p.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex items-center space-x-2 truncate">
                  <span className="font-black text-xs uppercase tracking-tight truncate">{p.name}</span>
                  {p.hasGuessed && p.lastDistance !== undefined && !isScoreboard && (
                    <span className="text-[10px] font-black text-[#8c6b4f] whitespace-nowrap bg-white px-2 py-0.5 rounded-md border border-black/5">
                      {formatDistance(p.lastDistance)}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                {p.hasGuessed ? (
                  <div className="w-5 h-5 bg-[#10b981] rounded-full flex items-center justify-center text-white shadow-sm">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                  </div>
                ) : (
                  <div className="w-5 h-5 border-2 border-dashed border-[#0f1a16]/20 rounded-full" title={strings.game.guessing}></div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Photo Preview Card */}
        <div className="hidden md:block px-6 py-2 shrink-0">
          <div className="p-3 bg-[#f9fbfa] rounded-[2rem] border border-black/5 shadow-inner">
            <button onClick={() => setIsFullscreenImage(true)} className="w-full relative group block">
              <img src={currentQ.imageUrl} className="w-full h-32 object-cover rounded-[1.5rem] border border-black/5 shadow-sm" alt="Spot preview" />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-[1.5rem] flex items-center justify-center backdrop-blur-[2px]">
                <span className="bg-white text-[#0f1a16] px-4 py-2 rounded-full font-black text-[9px] uppercase tracking-widest">{strings.common.expand}</span>
              </div>
            </button>
          </div>
        </div>

        {/* Action Controls - Docked & Always Accessible */}
        <div className="p-3 sm:p-4 md:p-6 border-t border-black/5 bg-white shrink-0 z-30 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
          {(!isRoundFinished && !isScoreboard) ? (
            <button 
              onClick={() => {
                const nonGuessed = gameState.players.filter(p => !p.hasGuessed);
                if (nonGuessed.length > 0) setShowForceConfirm(true); else onReveal?.();
              }}
              disabled={gameState.players.length === 0}
              className={`w-full py-4 md:py-5 btn-sleek !text-xs md:!text-sm ${
                gameState.players.length > 0 ? 'btn-sleek-pine !bg-[#2d4239]' : 'bg-[#f9fbfa] text-[#0f1a16]/10 shadow-none cursor-not-allowed'
              }`}
            >
              {strings.game.revealResults} ({gameState.players.filter(p => p.hasGuessed).length}/{gameState.players.length})
            </button>
          ) : isRoundFinished ? (
            <button 
              onClick={onShowScoreboard} 
              className="w-full py-4 md:py-5 btn-sleek btn-sleek-pine !bg-[#2d4239] !text-xs md:!text-sm flex items-center justify-center gap-2"
            >
              <span>{isLastRound ? strings.game.revealFinalStanding : strings.game.viewStandings}</span>
              <span className="text-sm">→</span>
            </button>
          ) : (
            <button 
              onClick={onNext} 
              className="w-full py-4 md:py-5 btn-sleek btn-sleek-pine !bg-[#2d4239] !text-xs md:!text-sm flex items-center justify-center gap-2"
            >
              <span>{isLastRound ? strings.game.finishExpedition : strings.game.startNextLocation}</span>
              <span className="text-sm">→</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Map or Scoreboard Area */}
      <div className="flex-1 h-[54%] md:h-full relative bg-[#f9fbfa] p-2 sm:p-4 md:p-8 flex flex-col overflow-hidden">
        {isScoreboard ? (
          <Scoreboard 
            players={gameState.players} 
            isLastRound={isLastRound} 
            isHost 
            onAnimationComplete={() => onSetCanProceed(true)}
            onProceed={onNext}
            canProceed={canProceed}
          />
        ) : (
          <Map center={currentQ.location} zoom={14} markers={markers} lines={lines} roundIndex={gameState.currentQuestionIndex} />
        )}
      </div>

      {isFullscreenImage && (
        <ImageOverlay imageUrl={currentQ.imageUrl} onClose={() => setIsFullscreenImage(false)} />
      )}
    </div>
  );
};

export default HostBoard;