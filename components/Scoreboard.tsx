import React, { useState, useEffect, useMemo } from 'react';
import { Player } from '../types';
import { strings } from '../i18n';

interface ScoreboardProps {
  players: Player[];
  isLastRound: boolean;
  onAnimationComplete: () => void;
  isHost?: boolean;
  onProceed?: () => void;
  canProceed?: boolean;
}

const Scoreboard: React.FC<ScoreboardProps> = ({ 
  players, 
  isLastRound, 
  onAnimationComplete, 
  isHost,
  onProceed,
  canProceed 
}) => {
  const [step, setStep] = useState<'initial' | 'showingPoints' | 'counting' | 'sorting'>('initial');
  const [visibleCount, setVisibleCount] = useState(0); 
  const [displayScores, setDisplayScores] = useState<Record<string, number>>(
    Object.fromEntries(players.map(p => [p.id, p.score - (p.lastPointsGained || 0)]))
  );

  // Stable key of player scores to avoid restarting timers on superficial state identity changes
  const playersKey = useMemo(() => {
    return players.map(p => `${p.id}:${p.score}:${p.lastPointsGained || 0}`).join(',');
  }, [players]);

  const sortedFinal = useMemo(() => {
    return [...players].sort((a, b) => b.score - a.score);
  }, [players]);

  const rankingFromLastToFirst = useMemo(() => {
    return [...sortedFinal].reverse();
  }, [sortedFinal]);

  const sortedInitial = useMemo(() => {
    return [...players].sort((a, b) => {
      const scoreA = a.score - (a.lastPointsGained || 0);
      const scoreB = b.score - (b.lastPointsGained || 0);
      return scoreB - scoreA;
    });
  }, [players]);

  const currentList = step === 'sorting' || isLastRound ? sortedFinal : sortedInitial;

  useEffect(() => {
    if (isLastRound) {
      const interval = setInterval(() => {
        setVisibleCount(prev => {
          if (prev >= players.length) {
            clearInterval(interval);
            onAnimationComplete();
            return prev;
          }
          return prev + 1;
        });
      }, 1800);
      return () => clearInterval(interval);
    } else {
      const timers = [
        setTimeout(() => setStep('showingPoints'), 1000),
        setTimeout(() => setStep('counting'), 2500),
        setTimeout(() => {
          const newScores = Object.fromEntries(players.map(p => [p.id, p.score]));
          setDisplayScores(newScores);
        }, 3000),
        setTimeout(() => setStep('sorting'), 4500),
        setTimeout(() => onAnimationComplete(), 5500)
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [isLastRound, playersKey, onAnimationComplete]);

  if (isLastRound) {
    const revealedPlayers = rankingFromLastToFirst.slice(0, visibleCount).reverse();

    return (
      <div className="flex-1 w-full h-full flex flex-col items-center bg-white rounded-[2rem] md:rounded-[3.5rem] shadow-2xl border border-black/5 overflow-hidden animate-in fade-in duration-700">
        <div className="p-6 md:p-12 pb-4 md:pb-6 text-center shrink-0">
          <p className="text-[10px] font-black text-[#8c6b4f] uppercase tracking-[0.5em] mb-2 md:mb-4 animate-pulse">{strings.game.finalStandings}</p>
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-[#0f1a16] leading-none">
            {strings.game.expeditionComplete}
          </h2>
        </div>
        <div className="flex-1 min-h-0 w-full overflow-y-auto px-4 md:px-6 pb-12 scroll-smooth-touch">
          <div className="max-w-lg mx-auto space-y-4 md:space-y-6 pt-2 md:pt-4">
            {revealedPlayers.map((p) => {
              const rank = sortedFinal.findIndex(sp => sp.score === p.score) + 1;
              const isWinner = rank === 1;
              return (
                <div 
                  key={p.id} 
                  className={`flex items-center justify-between p-4 md:p-8 rounded-[1.8rem] md:rounded-[2.5rem] border transition-all duration-1000 animate-in zoom-in slide-in-from-bottom-12 ${isWinner ? 'bg-[#ca8a04] text-white border-transparent shadow-[0_30px_60px_-15px_rgba(202,138,4,0.4)] scale-105 mb-6 md:mb-10 mt-2 md:mt-4' : 'bg-[#f9fbfa] border-black/5 shadow-sm'}`}
                >
                  <div className="flex items-center space-x-4 md:space-x-6">
                    <div className={`text-2xl md:text-4xl font-black ${isWinner ? 'text-white' : 'opacity-10 text-[#0f1a16]'}`}>#{rank}</div>
                    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-[1.3rem] md:rounded-[1.8rem] flex items-center justify-center font-black text-xl md:text-3xl shadow-xl ${isWinner ? 'bg-white text-[#ca8a04]' : 'text-white'}`} style={{ backgroundColor: isWinner ? undefined : p.color }}>
                      {(p.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className={`font-black uppercase tracking-tight text-sm md:text-lg ${isWinner ? 'text-white' : 'text-[#0f1a16]'}`}>{p.name}</div>
                      {isWinner && visibleCount === players.length && <div className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] opacity-80">{strings.game.expeditionLeader}</div>}
                    </div>
                  </div>
                  <div className={`text-xl md:text-3xl font-black tracking-tighter ${isWinner ? 'text-white' : 'text-[#2d4239]'}`}>{strings.game.points(p.score)}</div>
                </div>
              );
            })}
            {visibleCount < players.length && (
               <div className="py-6 md:py-10 flex justify-center">
                  <div className="flex space-x-2">
                     <div className="w-2 h-2 bg-[#8c6b4f] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                     <div className="w-2 h-2 bg-[#8c6b4f] rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                     <div className="w-2 h-2 bg-[#8c6b4f] rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                  </div>
               </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full flex flex-col items-center bg-white rounded-[2rem] md:rounded-[3.5rem] shadow-2xl border border-black/5 overflow-hidden">
      <h2 className="text-2xl md:text-3xl font-black p-6 md:p-10 pb-3 md:pb-6 uppercase tracking-tight text-[#0f1a16] shrink-0 text-center">
        {strings.game.roundResults}
      </h2>
      <div className="flex-1 min-h-0 w-full overflow-y-auto px-4 md:px-6 pb-6 md:pb-12 scroll-smooth-touch">
        <div className="max-w-lg mx-auto space-y-3 md:space-y-4">
          {currentList.map((p) => {
            const isGaining = step === 'showingPoints';
            const points = p.lastPointsGained || 0;
            
            return (
              <div 
                key={p.id} 
                className="flex items-center justify-between p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] bg-[#f9fbfa] border border-black/5 shadow-sm transition-all duration-700"
              >
                <div className="flex items-center space-x-4 md:space-x-5">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-[1rem] md:rounded-[1.25rem] flex items-center justify-center font-black text-lg md:text-xl text-white shadow-md shrink-0" style={{ backgroundColor: p.color }}>
                    {(p.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="font-black uppercase tracking-tight text-[#0f1a16] text-xs md:text-sm truncate max-w-[150px] sm:max-w-xs">{p.name}</div>
                </div>
                
                <div className="flex items-center space-x-3 md:space-x-4">
                  {isGaining && points > 0 && !isHost && (
                    <div className="px-3 md:px-4 py-1.5 md:py-2 bg-[#10b981] text-white rounded-full font-black text-[9px] md:text-[10px] uppercase tracking-widest animate-in zoom-in bounce-in duration-500">
                      +{points}
                    </div>
                  )}
                  {isHost && isGaining && points > 0 && (
                    <div className="text-[10px] font-black text-[#10b981] animate-in zoom-in duration-300">+{points}</div>
                  )}
                  <div className="text-lg md:text-xl font-black text-[#2d4239] tabular-nums min-w-[3ch] text-right">
                    {displayScores[p.id] !== undefined ? displayScores[p.id] : p.score}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Scoreboard;