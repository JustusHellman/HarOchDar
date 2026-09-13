import React from 'react';
import { Question } from '../types';
import { strings } from '../i18n';

interface SpotListProps {
  questions: Question[];
  onUpdateQuestion: (id: string, updates: Partial<Question>) => void;
  onEditLocation: (q: Question) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onDelete: (id: string) => void;
}

const SpotList: React.FC<SpotListProps> = ({ 
  questions, 
  onUpdateQuestion, 
  onEditLocation, 
  onMove, 
  onDelete 
}) => {
  return (
    <div className="space-y-4 mt-8">
      {questions.map((q, idx) => (
        <div key={q.id} className="bg-white rounded-[2.5rem] border border-black/5 p-4 flex items-center space-x-6 shadow-sm">
          <img src={q.imageUrl} className="w-20 h-20 rounded-[1.5rem] object-cover" alt={q.title} />
          <div className="flex-1 min-w-0">
            <input 
              type="text" 
              value={q.title || ''} 
              onChange={(e) => onUpdateQuestion(q.id, { title: e.target.value })} 
              className="bg-transparent border-none p-0 text-lg font-black tracking-tight uppercase focus:ring-0 w-full mb-1" 
            />
            <button 
              onClick={() => onEditLocation(q)} 
              className="text-[9px] text-[#8c6b4f] font-black uppercase tracking-[0.3em]"
            >
              {strings.creator.editPin}
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex flex-col text-[#2d4239]">
              <button 
                onClick={() => onMove(idx, 'up')} 
                disabled={idx === 0} 
                className={`p-1 transition-all ${idx === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-70 hover:opacity-100 hover:scale-110 active:scale-95'}`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" /></svg>
              </button>
              <button 
                onClick={() => onMove(idx, 'down')} 
                disabled={idx === questions.length - 1} 
                className={`p-1 transition-all ${idx === questions.length - 1 ? 'opacity-20 cursor-not-allowed' : 'opacity-70 hover:opacity-100 hover:scale-110 active:scale-95'}`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
              </button>
            </div>
            <button onClick={() => onDelete(q.id)} className="p-4 bg-[#7c2d12]/5 text-[#7c2d12] rounded-2xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SpotList;