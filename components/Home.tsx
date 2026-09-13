import React from 'react';
import { SwapTLogo, FlyingWordsBackground } from './Branding';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '../i18n';

interface HomeProps {
  onJoin: () => void;
  onDesign: () => void;
}

const Home: React.FC<HomeProps> = ({ onJoin, onDesign }) => {
  const { strings } = useLanguage();

  return (
    <div className="h-screen bg-[#f9fbfa] text-[#0f1a16] overflow-hidden flex flex-col relative selection:bg-[#8c6b4f]/20">
      <FlyingWordsBackground />
      <div className="fixed top-5 right-5 sm:top-6 sm:right-6 z-50">
        <LanguageToggle />
      </div>
      <div className="fixed -top-80 -left-60 w-[1000px] h-[1000px] bg-[#2d4239]/5 blur-[180px] rounded-full pointer-events-none"></div>
      <div className="fixed -bottom-80 -right-60 w-[1000px] h-[1000px] bg-[#8c6b4f]/5 blur-[180px] rounded-full pointer-events-none"></div>
      <main className="flex-1 max-w-6xl mx-auto w-full flex flex-col items-center relative py-10 md:py-12 px-6 z-10 gap-8 md:gap-12 overflow-y-auto scroll-smooth-touch">
        <div className="flex flex-col items-center select-none text-center pt-2">
            <SwapTLogo />
        </div>
        <section className="w-full max-w-3xl flex flex-col items-center gap-10 md:gap-14">
            <div className="w-full text-center flex flex-col items-center space-y-8">
              <div className="bg-white/45 backdrop-blur-md px-6 md:px-10 py-8 md:py-10 rounded-[2.5rem] border border-black/5 shadow-sm space-y-4 md:space-y-6">
                <h1 className="text-3xl md:text-6xl text-[#0f1a16] leading-[1.1] font-black tracking-tight">{strings.home.subtitle}</h1>
                <p className="text-[#0f1a16]/60 text-sm md:text-base font-bold uppercase tracking-[0.2em] max-w-lg mx-auto">{strings.home.tagline}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center w-full max-w-xl mx-auto px-2 relative z-20">
                <button onClick={onDesign} className="px-8 py-5 md:py-6 btn-sleek btn-sleek-oak text-sm md:text-base flex-1">
                  <svg className="w-4 md:w-5 h-4 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  {strings.home.designTrail}
                </button>
                <button onClick={onJoin} className="px-8 py-5 md:py-6 btn-sleek btn-sleek-pine text-sm md:text-base flex-1">
                  <svg className="w-4 md:w-5 h-4 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  {strings.home.joinQuest}
                </button>
              </div>
            </div>
        </section>
      </main>
    </div>
  );
};

export default Home;