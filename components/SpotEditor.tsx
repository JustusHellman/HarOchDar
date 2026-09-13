import React from 'react';
import Map from './Map';
import { Location } from '../types';
import { strings } from '../i18n';

interface SpotEditorProps {
  pendingQuestion: {
    imageUrl: string;
    location: Location;
    editingId?: string;
  };
  onUpdateLocation: (loc: Location) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const SpotEditor: React.FC<SpotEditorProps> = ({ pendingQuestion, onUpdateLocation, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-[#f9fbfa] flex flex-col">
      <header className="p-6 flex justify-between items-center bg-white/70 backdrop-blur-xl border-b border-[#2d4239]/5">
        <h2 className="text-lg font-black uppercase tracking-[0.2em] text-[#0f1a16]">
          {pendingQuestion.editingId ? strings.creator.editSpot : strings.creator.tagSpot}
        </h2>
        <button onClick={onCancel} className="text-[#8c6b4f] font-bold uppercase text-[10px] tracking-widest px-4 py-2">
          {strings.common.back}
        </button>
      </header>
      <main className="flex-1 flex flex-col md:flex-row overflow-y-auto pb-24 scroll-smooth-touch">
        <div className="w-full md:w-1/2 p-6 flex items-center justify-center bg-[#2d4239]/5">
          <img src={pendingQuestion.imageUrl} className="max-h-full max-w-full rounded-[2.5rem] shadow-2xl object-contain border-4 border-white" alt="Pending spot" />
        </div>
        <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col space-y-6">
           <div className="h-[350px] md:flex-1 rounded-[2.5rem] overflow-hidden border border-black/5 shadow-xl relative">
             <Map 
               center={pendingQuestion.location} 
               zoom={17} 
               onLocationSelect={onUpdateLocation} 
               markers={[{ position: pendingQuestion.location, icon: 'target' }]} 
             />
           </div>
           <button onClick={onConfirm} className="w-full py-6 btn-sleek btn-sleek-pine !bg-[#2d4239] !text-lg !tracking-widest">
             {strings.creator.confirmMarker}
           </button>
        </div>
      </main>
    </div>
  );
};

export default SpotEditor;