
import React from 'react';
import { GameState, Player } from '../types';
import { strings } from '../i18n';
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react';

interface LobbyProps {
  gameState: GameState;
  isHost: boolean;
  currentPlayer: Player | null;
  onStart: () => void;
  onBack: () => void;
  onKick: (id: string) => void;
}

const Lobby: React.FC<LobbyProps> = ({ gameState, isHost, onStart, currentPlayer, onBack, onKick }) => {
  const joinUrl = `${window.location.origin}${window.location.pathname}?join=${gameState.id}`;
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);

  return (
    <div className="min-h-screen bg-[#f9fbfa] flex flex-col text-[#0f1a16] selection:bg-[#8c6b4f]/20 relative">
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
                onClick={onBack}
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

      <div className="bg-white/70 backdrop-blur-xl p-10 pt-16 rounded-b-[4rem] shadow-[0_30px_60px_-15px_rgba(45,66,57,0.05)] border-b border-[#2d4239]/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#8c6b4f]/5 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#2d4239]/5 blur-[100px] rounded-full -translate-x-1/2 translate-y-1/2"></div>
        
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-start relative z-10 gap-6">
          <div className="flex-1">
             <button onClick={() => setShowExitConfirm(true)} className="text-[#8c6b4f] text-[10px] font-black uppercase tracking-[0.4em] mb-6 flex items-center hover:opacity-70 transition-opacity">
               <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
               </svg>
               {strings.lobby.backToDash}
             </button>
            <h1 className="text-4xl font-black mb-1 tracking-tight uppercase text-[#0f1a16]">{strings.lobby.title}</h1>
            <p className="text-[#2d4239]/60 font-medium text-sm">{strings.lobby.subtitle}</p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-6 items-center">
            {isHost && (
              <div className="bg-white p-4 rounded-3xl border border-[#2d4239]/10 shadow-lg flex flex-col items-center gap-3 group transition-all hover:scale-[1.05]">
                <QRCodeSVG 
                  value={joinUrl} 
                  size={120} 
                  level="H" 
                  includeMargin={false} 
                  className="rounded-xl overflow-hidden"
                />
                <span className="text-[8px] font-black uppercase tracking-widest text-[#2d4239]/40">{strings.lobby.scanToJoin}</span>
              </div>
            )}
            <div className="md:text-right bg-[#2d4239]/5 px-8 py-5 rounded-[2rem] border border-[#2d4239]/10 shadow-sm backdrop-blur-md h-fit">
              <span className="text-[9px] uppercase font-black tracking-[0.6em] text-[#8c6b4f] mb-1 block">{strings.lobby.roomCode}</span>
              <div className="text-4xl font-bold tracking-[0.1em] text-[#2d4239]">{gameState.id}</div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-2xl w-full mx-auto p-6 md:p-10 -mt-10 relative z-20">
        <div className="bg-white rounded-[3.5rem] shadow-[0_40px_80px_-20px_rgba(15,26,22,0.1)] overflow-hidden border border-black/5">
          <div className="p-8 border-b border-black/5 flex justify-between items-center bg-[#f9fbfa]/30">
            <h3 className="font-black text-[#2d4239]/40 uppercase text-[10px] tracking-[0.4em]">{strings.lobby.playersJoined(gameState.players.length)}</h3>
            <div className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.4)] animate-pulse"></div>
          </div>
          <div className="divide-y divide-black/5 max-h-[50vh] overflow-y-auto scroll-smooth-touch">
            {gameState.players.length === 0 ? (
              <div className="p-20 text-center opacity-20">
                <p className="mb-4 font-bold uppercase tracking-widest text-sm">{strings.lobby.noPlayers}</p>
                <div className="inline-block px-10 py-5 bg-[#f9fbfa] rounded-[2rem] font-bold text-3xl tracking-[0.3em] select-all">{gameState.id}</div>
              </div>
            ) : (
              gameState.players.map(p => (
                <div key={p.id} className="p-6 flex items-center justify-between hover:bg-[#f9fbfa] transition-colors">
                  <div className="flex items-center space-x-6">
                    <div className="w-14 h-14 rounded-[1.5rem] flex items-center justify-center font-black text-2xl text-white shadow-lg border-2 border-white/20" style={{ backgroundColor: p.color }}>
                      {(p.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-black text-[#0f1a16] block uppercase tracking-tight text-lg">{p.name} {p.id === currentPlayer?.id ? strings.lobby.youLabel : ""}</span>
                      <span className="text-[9px] text-[#2d4239]/40 uppercase font-black tracking-[0.4em]">{strings.lobby.explorer}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {p.id === gameState.hostId && <span className="text-[8px] bg-[#2d4239] text-white px-3 py-1.5 rounded-full font-black uppercase tracking-widest">{strings.lobby.host}</span>}
                    {isHost && p.id !== gameState.hostId && (
                      <button 
                        onClick={() => onKick(p.id)}
                        className="text-[9px] font-black text-[#7c2d12]/40 hover:text-[#7c2d12] uppercase tracking-[0.2em] transition-colors"
                      >
                        {strings.common.kick}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {isHost ? (
          <div className="mt-12">
            <button 
              disabled={gameState.players.length === 0}
              onClick={onStart}
              className={`w-full py-6 btn-sleek !text-lg !tracking-[0.2em] ${gameState.players.length > 0 ? 'btn-sleek-pine !bg-[#2d4239]' : 'bg-[#f9fbfa] text-[#0f1a16]/10 shadow-none cursor-not-allowed'}`}
            >
              {strings.lobby.startExpedition}
            </button>
          </div>
        ) : (
          <div className="mt-12 p-12 bg-white/40 rounded-[3.5rem] border-2 border-dashed border-[#2d4239]/10 text-center">
            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl animate-bounce">
              <svg className="w-8 h-8 text-[#2d4239]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-[#2d4239]/40 font-bold uppercase tracking-[0.2em] text-xs">{strings.lobby.waitingForHost}</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Lobby;
