
import React, { useState, useEffect } from 'react';
import { User, Trail } from '../types';
import { useLanguage } from '../i18n';
import { getLatestDraft, clearDraft, formatDraftTime, TrailDraft } from '../lib/draftStorage';
import { TrailShareModal } from './TrailShareModal';
import { LanguageToggle } from './LanguageToggle';

interface DashboardProps {
  user: User;
  trails: Trail[];
  isLoading?: boolean;
  onNewTrail: () => void;
  onEditTrail: (trail: Trail) => void;
  onHostTrail: (trail: Trail) => void;
  onSoloPlayTrail?: (trail: Trail) => void;
  onViewLeaderboard?: (trail: Trail) => void;
  onDeleteTrail: (id: string) => void;
  onLogout: () => void;
  onResumeHost?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  user, 
  trails, 
  isLoading,
  onNewTrail, 
  onEditTrail, 
  onHostTrail, 
  onSoloPlayTrail,
  onViewLeaderboard,
  onDeleteTrail, 
  onLogout, 
  onResumeHost 
}) => {
  const { strings } = useLanguage();
  const [trailToDelete, setTrailToDelete] = useState<Trail | null>(null);
  const [trailToShare, setTrailToShare] = useState<Trail | null>(null);
  const [unsavedDraft, setUnsavedDraft] = useState<TrailDraft | null>(null);

  useEffect(() => {
    setUnsavedDraft(getLatestDraft());
  }, []);

  const handleResumeDraft = () => {
    if (!unsavedDraft) return;
    if (unsavedDraft.trailId) {
      const existing = trails.find(t => t.id === unsavedDraft.trailId);
      if (existing) {
        onEditTrail({
          ...existing,
          name: unsavedDraft.name,
          questions: unsavedDraft.questions,
          startingView: unsavedDraft.startingView
        });
        return;
      }
    }
    onEditTrail({
      id: unsavedDraft.trailId || '',
      name: unsavedDraft.name,
      creatorId: user.id,
      lastUpdated: unsavedDraft.savedAt,
      startingView: unsavedDraft.startingView,
      questions: unsavedDraft.questions
    });
  };

  const handleDiscardDraft = () => {
    if (unsavedDraft) {
      clearDraft(unsavedDraft.trailId);
      setUnsavedDraft(null);
    }
  };

  const confirmDelete = () => {
    if (trailToDelete) {
      if (unsavedDraft && unsavedDraft.trailId === trailToDelete.id) {
        clearDraft(trailToDelete.id);
        setUnsavedDraft(null);
      }
      onDeleteTrail(trailToDelete.id);
      setTrailToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9fbfa] text-[#0f1a16] p-6 flex flex-col selection:bg-[#8c6b4f]/20">
      {trailToDelete && (
        <div className="fixed inset-0 z-[500] bg-[#2d4239]/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white border border-black/5 p-8 rounded-[3rem] w-full max-sm text-center shadow-2xl">
            <div className="w-16 h-16 bg-[#7c2d12]/10 text-[#7c2d12] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-xl font-black mb-2 uppercase tracking-tight">{strings.dashboard.deleteTrailTitle}</h3>
            <p className="text-[#0f1a16]/40 text-sm mb-8 font-medium">{strings.dashboard.deleteTrailDesc(trailToDelete.name, trailToDelete.questions.length)}</p>
            <div className="flex gap-4">
              <button onClick={() => setTrailToDelete(null)} className="flex-1 py-4 bg-[#f9fbfa] rounded-2xl font-bold text-xs uppercase tracking-widest">{strings.common.cancel}</button>
              <button onClick={confirmDelete} className="flex-1 py-4 bg-[#7c2d12] text-white rounded-2xl font-bold text-xs uppercase tracking-widest">{strings.common.delete}</button>
            </div>
          </div>
        </div>
      )}

      {trailToShare && (
        <TrailShareModal 
          trail={trailToShare} 
          onClose={() => setTrailToShare(null)} 
          onPlaySolo={onSoloPlayTrail ? () => onSoloPlayTrail(trailToShare) : undefined}
        />
      )}

      <header className="max-w-4xl w-full mx-auto flex justify-between items-center py-10 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase text-[#0f1a16]">{strings.dashboard.title}</h1>
          <p className="text-[#8c6b4f] font-bold text-xs uppercase tracking-[0.4em] mt-1">{strings.dashboard.greeting(user.username)}</p>
        </div>
        <div className="flex items-center gap-4">
          <LanguageToggle />
          <button onClick={onLogout} className="text-[10px] font-bold text-[#7c2d12] uppercase tracking-[0.4em] opacity-60 hover:opacity-100 transition-opacity">{strings.dashboard.logout}</button>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto flex-1 flex flex-col space-y-10 pb-12">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-6">
            <div className="w-16 h-16 border-4 border-[#2d4239] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-black uppercase tracking-[0.3em] text-[#2d4239] text-xs">{strings.dashboard.searchingTrails}</p>
          </div>
        ) : (
          <>
            {unsavedDraft && (
              <div className="w-full p-6 sm:p-8 rounded-[2.5rem] bg-[#8c6b4f]/10 border border-[#8c6b4f]/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 animate-in zoom-in-95 duration-300 shadow-sm">
                <div className="flex items-center space-x-5">
                  <div className="w-14 h-14 rounded-2xl bg-[#8c6b4f] text-white flex items-center justify-center shrink-0 shadow-md">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8c6b4f]">{strings.creator.unsavedTrailDraft}</span>
                      <span className="text-[9px] text-[#0f1a16]/40 font-semibold">• {strings.creator.savedAtTime(formatDraftTime(unsavedDraft.savedAt))}</span>
                    </div>
                    <p className="text-lg font-black uppercase tracking-tight text-[#0f1a16] mt-0.5">
                      {unsavedDraft.name || strings.creator.untitledTrail} <span className="text-xs font-bold text-[#8c6b4f] opacity-80">({unsavedDraft.questions.length} spot{unsavedDraft.questions.length !== 1 ? 's' : ''})</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <button 
                    onClick={handleDiscardDraft} 
                    className="px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#7c2d12] hover:bg-[#7c2d12]/10 transition-colors"
                  >
                    {strings.creator.discard}
                  </button>
                  <button 
                    onClick={handleResumeDraft} 
                    className="flex-1 sm:flex-initial px-8 py-3.5 rounded-2xl bg-[#8c6b4f] text-white font-black text-xs uppercase tracking-widest hover:bg-[#73563d] transition-all shadow-md hover:scale-[1.02]"
                  >
                    {strings.creator.resumeDraft}
                  </button>
                </div>
              </div>
            )}

            {onResumeHost && (
              <button 
                onClick={onResumeHost}
                className="w-full p-8 rounded-[2.5rem] bg-[#2d4239] text-white flex items-center justify-between group shadow-xl hover:scale-[1.02] transition-all animate-in zoom-in duration-500"
              >
                <div className="flex items-center space-x-6">
                   <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></div>
                   <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">{strings.dashboard.activeSessionFound}</p>
                      <p className="text-lg font-black uppercase tracking-tight">{strings.dashboard.resumeExpedition}</p>
                   </div>
                </div>
                <svg className="w-6 h-6 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              </button>
            )}

            <button 
              onClick={onNewTrail}
              className="w-full p-10 rounded-[3rem] border-2 border-dashed border-[#2d4239]/10 hover:border-[#2d4239]/40 hover:bg-[#2d4239]/5 transition-all flex flex-col items-center justify-center space-y-4 group shadow-sm bg-white"
            >
              <div className="w-16 h-16 rounded-3xl bg-[#2d4239] flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-xl">
                 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              </div>
              <span className="text-sm font-black uppercase tracking-[0.2em] text-[#2d4239]">{strings.dashboard.designNew}</span>
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {trails.map(trail => (
                <div key={trail.id} className="bg-white rounded-[3rem] p-8 border border-[#2d4239]/5 shadow-[0_20px_40px_-10px_rgba(45,66,57,0.05)] flex flex-col space-y-8 group hover:shadow-[0_40px_80px_-15px_rgba(45,66,57,0.1)] transition-all relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                    <svg className="w-24 h-24 text-[#2d4239]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" /></svg>
                  </div>
                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-black truncate mt-1 uppercase tracking-tight text-[#0f1a16]">{trail.name || strings.creator.untitledTrail}</h3>
                      <span className="text-[10px] text-[#2d4239]/60 font-bold uppercase tracking-widest">{strings.dashboard.spotsCount(trail.questions.length)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => setTrailToShare(trail)} 
                        title={strings.dashboard.shareTrailTitle}
                        className="text-[#0f1a16]/40 hover:text-[#2d4239] transition-colors p-2 rounded-xl hover:bg-black/5"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                      </button>
                      <button 
                        onClick={() => setTrailToDelete(trail)} 
                        title={strings.dashboard.deleteTrail}
                        className="text-[#0f1a16]/20 hover:text-[#7c2d12] transition-colors p-2 rounded-xl hover:bg-black/5"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 relative z-10">
                    <div className="flex gap-3">
                      <button onClick={() => onHostTrail(trail)} className="flex-1 py-3.5 btn-sleek btn-sleek-pine !bg-[#2d4239] text-xs font-black uppercase tracking-wider">{strings.dashboard.startGame} ({strings.dashboard.liveTag})</button>
                      <button onClick={() => onEditTrail(trail)} className="flex-1 py-3.5 btn-sleek btn-sleek-oak !bg-white !text-[#8c6b4f] border border-[#8c6b4f]/20 !shadow-none hover:!bg-[#8c6b4f]/5 text-xs font-black uppercase tracking-wider">{strings.dashboard.edit}</button>
                    </div>
                    <div className="flex gap-3">
                      {onSoloPlayTrail && (
                        <button 
                          onClick={() => onSoloPlayTrail(trail)} 
                          className="flex-1 py-3 rounded-2xl bg-[#8c6b4f]/10 text-[#8c6b4f] hover:bg-[#8c6b4f]/20 font-black text-xs uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span>{strings.dashboard.openTrail}</span>
                        </button>
                      )}
                      {onViewLeaderboard && (
                        <button 
                          onClick={() => onViewLeaderboard(trail)} 
                          className="flex-1 py-3 rounded-2xl bg-black/5 text-[#0f1a16]/70 hover:bg-black/10 font-black text-xs uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span>{strings.dashboard.leaderboard}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {trails.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-10 text-center">
                <svg className="w-20 h-20 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                <p className="font-bold uppercase tracking-widest text-sm">{strings.dashboard.noTrails}</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
