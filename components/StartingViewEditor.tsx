import React, { useState } from 'react';
import Map from './Map';
import { Location, Question } from '../types';
import { strings } from '../i18n';

interface StartingViewEditorProps {
  initialView?: { center: Location, zoom: number };
  questions: Question[];
  onSave: (view: { center: Location, zoom: number }) => void;
  onCancel: () => void;
}

const StartingViewEditor: React.FC<StartingViewEditorProps> = ({ initialView, questions, onSave, onCancel }) => {
  const [temporaryView, setTemporaryView] = useState<{ center: Location, zoom: number } | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);

  const viewCenter = initialView?.center || (questions.length > 0 ? questions[0].location : { lat: 51.505, lng: -0.09 });

  const handleSave = () => {
    if (showSavedToast) return;
    const finalView = temporaryView || { center: viewCenter, zoom: initialView?.zoom || 12 };
    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
      onSave(finalView);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#f9fbfa] flex flex-col overflow-hidden">
      <header className="p-6 flex justify-between items-center bg-white/70 backdrop-blur-xl border-b border-[#2d4239]/5 z-[300]">
        <h2 className="text-lg font-black uppercase tracking-[0.2em] text-[#0f1a16]">{strings.creator.setStartingView}</h2>
        <button onClick={onCancel} className="text-[#8c6b4f] font-bold uppercase text-[10px] tracking-widest">{strings.common.back}</button>
      </header>
      <main className="flex-1 relative">
         <Map center={viewCenter} zoom={initialView?.zoom || 12} onViewChange={setTemporaryView} />
         
         <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[2000]">
            <div className="w-10 h-10 border-2 border-[#2d4239] rounded-full flex items-center justify-center bg-white/40 backdrop-blur-sm shadow-xl">
               <div className="w-2 h-2 bg-[#2d4239] rounded-full"></div>
            </div>
         </div>

         {showSavedToast && (
           <div className="absolute top-10 inset-x-0 flex justify-center z-[5000]">
              <div className="bg-[#10b981] text-white px-8 py-4 rounded-full font-black uppercase tracking-widest shadow-2xl animate-in fade-in zoom-in duration-300">
                {strings.creator.viewSaved}
              </div>
           </div>
         )}

         <div className="absolute bottom-10 inset-x-0 flex justify-center p-6 z-[4000] pointer-events-none">
            <button 
              onClick={handleSave} 
              className="pointer-events-auto px-8 py-3.5 btn-sleek btn-sleek-pine !bg-[#2d4239] shadow-[0_20px_50px_rgba(15,26,22,0.4)] !text-[10px] !tracking-widest"
            >
              {strings.creator.setCurrentViewAsStart}
            </button>
         </div>
      </main>
    </div>
  );
};

export default StartingViewEditor;