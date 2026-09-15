import React from 'react';
import { useLanguage } from '../i18n';

interface HowToPlayModalProps {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => {
  const { strings } = useLanguage();

  const handleDismiss = () => {
    try {
      localStorage.setItem('locateit_has_seen_how_to_play', 'true');
    } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[6000] bg-[#0f1a16]/50 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white border border-black/5 rounded-[2.5rem] w-full max-w-lg shadow-[0_25px_60px_-15px_rgba(15,26,22,0.3)] flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 relative text-[#0f1a16]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title & Close button */}
        <div className="p-5 sm:p-6 pb-4 border-b border-black/5 flex items-start justify-between gap-4 bg-[#f9fbfa] shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#2d4239] text-white flex items-center justify-center shadow-md shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth={2.2} />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#0f1a16] leading-none">
                {strings.howToPlay.title}
              </h2>
              <p className="text-xs text-[#0f1a16]/50 font-bold uppercase tracking-wider mt-1">
                {strings.howToPlay.subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-2 rounded-2xl bg-black/5 hover:bg-black/10 text-[#0f1a16]/60 hover:text-[#0f1a16] transition-colors shrink-0"
            aria-label={strings.common.close}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 scroll-smooth-touch min-h-0">
          {/* Step 1 */}
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#f9fbfa] border border-black/5">
            <div className="w-10 h-10 rounded-xl bg-[#2d4239]/10 text-[#2d4239] flex items-center justify-center shrink-0 font-black text-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-[#0f1a16]">
                {strings.howToPlay.step1Title}
              </h3>
              <p className="text-xs text-[#0f1a16]/70 mt-1 font-medium leading-relaxed">
                {strings.howToPlay.step1Desc}
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#f9fbfa] border border-black/5">
            <div className="w-10 h-10 rounded-xl bg-[#8c6b4f]/15 text-[#8c6b4f] flex items-center justify-center shrink-0 font-black text-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-[#0f1a16]">
                {strings.howToPlay.step2Title}
              </h3>
              <p className="text-xs text-[#0f1a16]/70 mt-1 font-medium leading-relaxed">
                {strings.howToPlay.step2Desc}
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#f9fbfa] border border-black/5">
            <div className="w-10 h-10 rounded-xl bg-[#dc2626]/10 text-[#dc2626] flex items-center justify-center shrink-0 font-black text-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth={2} />
                <circle cx="12" cy="12" r="5" strokeWidth={2} />
                <circle cx="12" cy="12" r="1" strokeWidth={3} fill="currentColor" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-[#0f1a16]">
                {strings.howToPlay.step3Title}
              </h3>
              <p className="text-xs text-[#0f1a16]/70 mt-1 font-medium leading-relaxed">
                {strings.howToPlay.step3Desc}
              </p>
            </div>
          </div>

          {/* Explorer Tip */}
          <div className="p-3.5 rounded-2xl bg-[#2d4239]/5 border border-[#2d4239]/10 flex items-start gap-3">
            <span className="text-base leading-none mt-0.5">🛰️</span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-[#2d4239]">
                {strings.howToPlay.tipsTitle}
              </p>
              <p className="text-[11px] text-[#0f1a16]/60 font-medium mt-0.5 leading-snug">
                {strings.howToPlay.tipsDesc}
              </p>
            </div>
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-black/5 flex justify-center shrink-0">
          <button
            onClick={handleDismiss}
            className="w-full py-4 btn-sleek btn-sleek-pine !bg-[#2d4239] text-xs font-black uppercase tracking-widest text-white shadow-xl active:scale-95 flex items-center justify-center gap-2"
          >
            <span>{strings.howToPlay.gotItBtn}</span>
            <span className="text-sm">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};
