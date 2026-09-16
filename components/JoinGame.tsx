import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n';
import { LanguageToggle } from './LanguageToggle';

interface JoinGameProps {
  onBack: () => void;
  onJoin: (code: string, name: string, color: string) => void;
  onCodeChange?: (code: string) => void;
  isSearching: boolean;
  isRejoining?: boolean;
  error: string | null;
  prefilledCode?: string;
}

const availableColors = [
  '#2d4239', // Forest Pine
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
];

const JoinGame: React.FC<JoinGameProps> = ({ 
  onBack, 
  onJoin, 
  onCodeChange, 
  isSearching, 
  isRejoining, 
  error, 
  prefilledCode 
}) => {
  const { strings } = useLanguage();
  const isCodeLocked = Boolean(prefilledCode && prefilledCode.trim().length > 0);
  const [code, setCode] = useState(prefilledCode || '');
  
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('locateit_player_name') || '';
    } catch {
      return '';
    }
  });

  const [selectedColor, setSelectedColor] = useState(() => {
    try {
      const saved = localStorage.getItem('locateit_player_color');
      if (saved && availableColors.includes(saved)) return saved;
      return availableColors[0];
    } catch {
      return availableColors[0];
    }
  });

  const [customColor, setCustomColor] = useState(() => {
    try {
      const saved = localStorage.getItem('locateit_player_color');
      if (saved && !availableColors.includes(saved)) return saved;
      return '#3b82f6';
    } catch {
      return '#3b82f6';
    }
  });

  const [isCustomColor, setIsCustomColor] = useState(() => {
    try {
      const saved = localStorage.getItem('locateit_player_color');
      return Boolean(saved && !availableColors.includes(saved));
    } catch {
      return false;
    }
  });

  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prefilledCode) {
      setCode(prefilledCode);
    }
  }, [prefilledCode]);

  useEffect(() => {
    if (onCodeChange) {
      const trimmed = code.trim().toUpperCase();
      if (trimmed.length >= 4) {
        onCodeChange(trimmed);
      }
    }
  }, [code, onCodeChange]);

  const isOpenTrail = code.trim().toUpperCase().startsWith('OT');
  const activeColor = isCustomColor ? customColor : selectedColor;
  const isFormValid = Boolean(name.trim() && code.trim());

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[#f9fbfa] relative">
      <div className="fixed top-5 right-5 sm:top-6 sm:right-6 z-50">
        <LanguageToggle />
      </div>

      {isRejoining && (
        <div className="fixed inset-0 z-[50] bg-[#f9fbfa]/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-500">
          <div className="w-16 h-16 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mb-6 animate-bounce">
             <div className="w-6 h-6 border-4 border-[#2d4239] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-[#2d4239] font-black uppercase tracking-[0.4em] text-[10px]">{strings.join.rejoiningSession}</p>
        </div>
      )}

      <div className="max-w-md w-full my-auto">
        <button 
          onClick={onBack} 
          className="mb-6 text-[#2d4239]/70 hover:text-[#2d4239] flex items-center font-black text-xs uppercase tracking-widest transition-all group"
        >
           <svg className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
           </svg>
           {strings.join.back}
        </button>

        <div className="bg-white rounded-[2.5rem] p-7 sm:p-10 border border-black/5 shadow-[0_30px_70px_-15px_rgba(15,26,22,0.12)] space-y-6">
          <div className="text-center">
            <span className="text-[10px] font-black text-[#8c6b4f] uppercase tracking-[0.3em] block mb-1">
              {strings.appName}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0f1a16] tracking-tight uppercase">
              {strings.join.title}
            </h2>
            <p className="text-[#0f1a16]/60 text-xs font-bold uppercase tracking-wider mt-1">
              {strings.join.subtitle}
            </p>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (isFormValid) {
                onJoin(code.trim().toUpperCase(), name.trim(), activeColor);
              }
            }} 
            className="space-y-5"
          >
            {/* Field 1: Game Code / Trail ID */}
            <div>
              <div className="flex items-center justify-between mb-1.5 px-1">
                <label className="text-[11px] font-black text-[#2d4239] uppercase tracking-[0.2em]">
                  {strings.join.codeLabel}
                </label>
                {isCodeLocked && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#2d4239]/10 text-[#2d4239] text-[9px] font-black uppercase tracking-wider border border-[#2d4239]/15">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    {strings.join.linkedFromUrl}
                  </span>
                )}
              </div>

              <div className="relative">
                <input 
                  value={code}
                  disabled={isCodeLocked}
                  readOnly={isCodeLocked}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={strings.join.codeOrTrailPlaceholder} 
                  className={`w-full px-6 py-4 rounded-2xl outline-none font-mono uppercase font-black text-center tracking-[0.2em] text-lg transition-all ${
                    isCodeLocked 
                      ? 'bg-[#eef2f0] border border-[#2d4239]/20 text-[#0f1a16] cursor-default' 
                      : 'bg-[#f4f7f6] focus:bg-white border border-black/10 focus:border-[#2d4239] text-[#0f1a16] placeholder:text-[#0f1a16]/30 focus:ring-4 focus:ring-[#2d4239]/10'
                  }`}
                />
                {isSearching && (
                  <div className="absolute top-1/2 -translate-y-1/2 right-5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#8c6b4f] animate-ping"></div>
                  </div>
                )}
              </div>
              {isCodeLocked && (
                <p className="text-[10px] font-bold text-[#2d4239]/70 px-1 mt-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[#2d4239]/80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {strings.join.codeLockedNotice}
                </p>
              )}
            </div>

            {/* Field 2: Player Name */}
            <div>
              <div className="flex items-center justify-between mb-1.5 px-1">
                <label className="text-[11px] font-black text-[#2d4239] uppercase tracking-[0.2em]">
                  {strings.join.yourName}
                </label>
                <span className="text-[10px] font-bold text-[#8c6b4f] tracking-normal font-sans">
                  ({strings.join.enterNameHint})
                </span>
              </div>
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={strings.join.namePlaceholder} 
                autoFocus={isCodeLocked && !name}
                className="w-full px-6 py-4 bg-[#f4f7f6] focus:bg-white border border-black/10 focus:border-[#2d4239] rounded-2xl outline-none focus:ring-4 focus:ring-[#2d4239]/10 text-[#0f1a16] font-bold placeholder:text-[#0f1a16]/30 text-base transition-all" 
              />
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[#7c2d12] text-xs font-bold text-center tracking-tight animate-in fade-in zoom-in duration-300">
                {error}
              </div>
            )}

            {/* Field 3: Avatar Color Selection */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between px-1">
                <label className="text-[11px] font-black text-[#2d4239] uppercase tracking-[0.2em]">
                  {strings.join.pickColor}
                </label>
                <span 
                  className="w-4 h-4 rounded-full border border-white shadow-sm ring-1 ring-black/15 transition-colors shrink-0" 
                  style={{ backgroundColor: activeColor }} 
                />
              </div>
              
              <div className="bg-[#f4f7f6] p-3.5 rounded-2xl border border-black/5">
                <div className="grid grid-cols-6 gap-3 justify-items-center">
                  {availableColors.map(color => {
                    const isSelected = !isCustomColor && selectedColor === color;
                    return (
                      <button 
                        key={color} 
                        type="button"
                        onClick={() => {
                          setSelectedColor(color);
                          setIsCustomColor(false);
                        }} 
                        className={`w-8 h-8 rounded-full transition-all active:scale-90 ${
                          isSelected 
                            ? 'ring-4 ring-[#2d4239] scale-110 shadow-md border-2 border-white' 
                            : 'opacity-75 hover:opacity-100 hover:scale-105 border border-black/10'
                        }`} 
                        style={{ backgroundColor: color }} 
                      />
                    );
                  })}
                  
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
                      className={`w-8 h-8 rounded-full transition-all active:scale-90 flex items-center justify-center overflow-hidden border-2 ${
                        isCustomColor 
                          ? 'ring-4 ring-[#2d4239] scale-110 shadow-md border-white' 
                          : 'opacity-75 hover:opacity-100 border-dashed border-[#0f1a16]/30 bg-white'
                      }`}
                      style={{ 
                        backgroundColor: isCustomColor ? customColor : '#ffffff',
                      }}
                      title="Custom Color"
                    >
                      {!isCustomColor && (
                        <svg className="w-4 h-4 text-[#0f1a16]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v12M6 12h12" />
                        </svg>
                      )}
                      {isCustomColor && (
                        <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Submit Button */}
            <button 
              type="submit"
              disabled={!isFormValid}
              className={`w-full py-4.5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
                !isFormValid 
                  ? 'bg-[#2d4239]/10 text-[#2d4239]/40 border border-[#2d4239]/10 cursor-not-allowed shadow-none' 
                  : 'bg-[#2d4239] hover:bg-[#1f2e27] text-white shadow-xl shadow-[#2d4239]/20 hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              {isOpenTrail ? strings.join.startTrail : strings.join.joinLobby}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default JoinGame;
