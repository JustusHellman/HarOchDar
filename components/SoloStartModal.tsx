import React, { useState, useRef } from 'react';
import { Trail } from '../types';
import { strings } from '../i18n';
import { hasCompletedTrail } from '../lib/trailRuns';

interface SoloStartModalProps {
  trail: Trail;
  onStart: (name: string, color: string) => void;
  onViewLeaderboard: () => void;
  onClose: () => void;
}

const availableColors = [
  '#6366f1', // Indigo
  '#0d9488', // Teal
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#d946ef', // Fuchsia
  '#111827', // Black
  '#f97316', // Orange
  '#ec4899', // Pink
  '#65a30d', // Lime
  '#dcfea9', // Off-White
];

export const SoloStartModal: React.FC<SoloStartModalProps> = ({
  trail,
  onStart,
  onViewLeaderboard,
  onClose
}) => {
  const isCompleted = hasCompletedTrail(trail.id);

  React.useEffect(() => {
    if (isCompleted) {
      onViewLeaderboard();
    }
  }, [isCompleted, onViewLeaderboard]);

  const [name, setName] = useState(localStorage.getItem('locateit_player_name') || '');
  const [selectedColor, setSelectedColor] = useState(localStorage.getItem('locateit_player_color') || availableColors[0]);
  const [customColor, setCustomColor] = useState('#ffffff');
  const [isCustomColor, setIsCustomColor] = useState(false);
  const [copied, setCopied] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const finalColor = isCustomColor ? customColor : selectedColor;
    localStorage.setItem('locateit_player_name', name.trim());
    localStorage.setItem('locateit_player_color', finalColor);
    onStart(name.trim(), finalColor);
  };

  if (isCompleted) return null;

  return (
    <div className="fixed inset-0 z-[5000] bg-[#2d4239]/40 backdrop-blur-md flex items-center justify-center p-6 text-center animate-in fade-in duration-200 select-none">
      <div className="bg-white border border-black/5 p-8 sm:p-10 rounded-[3rem] w-full max-w-md shadow-2xl space-y-6">
        <div className="flex justify-between items-start">
          <div className="text-left">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8c6b4f]">{strings.solo.modalTitle}</span>
            <h3 className="text-2xl font-black uppercase tracking-tight text-[#0f1a16] truncate max-w-[260px]">{trail.name}</h3>
            <p className="text-xs font-bold text-[#0f1a16]/40 uppercase tracking-widest mt-0.5">{strings.solo.modalSubtitle(trail.questions.length)}</p>
          </div>
          <div className="flex items-center space-x-1">
            <button 
              type="button"
              onClick={() => {
                const soloUrl = `${window.location.origin}${window.location.pathname}?solo=${trail.id}`;
                navigator.clipboard.writeText(soloUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className={`p-2 rounded-xl transition-all ${copied ? 'bg-[#2d4239] text-white' : 'bg-black/5 hover:bg-black/10 text-[#0f1a16]/60'}`}
              title={copied ? strings.share.linkCopied : strings.share.copyLinkBtn}
            >
              {copied ? (
                <svg className="w-5 h-5 animate-in zoom-in" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              )}
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-black/5 hover:bg-black/10 text-[#0f1a16]/60 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 text-left">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#0f1a16]/40 ml-1">{strings.solo.playerNameLabel}</label>
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={strings.join.namePlaceholder} 
                required
                className="w-full mt-1.5 px-6 py-4 bg-[#f9fbfa] border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-[#2d4239]/20 text-[#0f1a16] font-bold transition-all text-sm" 
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#0f1a16]/40 ml-1">{strings.solo.avatarColorLabel}</label>
              <div className="grid grid-cols-6 gap-2.5 justify-items-center">
                {availableColors.map(color => (
                  <button 
                    key={color} 
                    type="button"
                    onClick={() => {
                      setSelectedColor(color);
                      setIsCustomColor(false);
                    }} 
                    className={`w-8 h-8 rounded-full transition-all active:scale-90 ${!isCustomColor && selectedColor === color ? 'ring-4 ring-black/10 scale-110 shadow-lg border-2 border-white' : 'opacity-40 hover:opacity-100'}`} 
                    style={{ backgroundColor: color }} 
                  />
                ))}

                {/* Custom Color Slot */}
                <div className="relative">
                  <input 
                    type="color"
                    ref={colorInputRef}
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      setIsCustomColor(true);
                    }}
                    className="sr-only"
                  />
                  <button 
                    type="button"
                    onClick={() => colorInputRef.current?.click()}
                    className={`w-8 h-8 rounded-full transition-all active:scale-90 flex items-center justify-center overflow-hidden border-2 ${isCustomColor ? 'ring-4 ring-black/10 scale-110 shadow-lg border-white' : 'opacity-40 hover:opacity-100 border-dashed border-[#0f1a16]/20'}`}
                    style={{ backgroundColor: isCustomColor ? customColor : 'transparent' }}
                  >
                    {!isCustomColor && (
                      <svg className="w-4 h-4 text-[#0f1a16]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v12M6 12h12" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button 
                type="submit"
                disabled={!name.trim()}
                className={`w-full py-4 btn-sleek text-xs font-black uppercase tracking-widest ${name.trim() ? 'btn-sleek-pine !bg-[#2d4239]' : 'bg-black/5 text-[#0f1a16]/20 cursor-not-allowed shadow-none'}`}
              >
                {strings.solo.startBtn}
              </button>

              <button 
                type="button"
                onClick={onViewLeaderboard}
                className="w-full py-3.5 bg-[#f9fbfa] hover:bg-[#8c6b4f]/10 text-[#8c6b4f] rounded-2xl font-black text-xs uppercase tracking-widest transition-colors border border-black/5"
              >
                {strings.solo.viewLeaderboardBtn}
              </button>
            </div>
          </form>
      </div>
    </div>
  );
};
