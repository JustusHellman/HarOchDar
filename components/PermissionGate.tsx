import React from 'react';
import { usePermissions, PermissionState } from '../hooks/usePermissions';
import { strings } from '../i18n';

interface PermissionModalProps {
  onClose: () => void;
}

const StatusBadge: React.FC<{ status: PermissionState, label: string }> = ({ status, label }) => {
  const colorClass = status === 'granted' ? 'bg-[#10b981]/10 text-[#10b981]' : 
                     status === 'denied' ? 'bg-[#7c2d12]/10 text-[#7c2d12]' : 'bg-[#2d4239]/5 text-[#2d4239]/40';
  
  const statusText = status === 'granted' ? strings.permissions.granted : 
                    status === 'denied' ? strings.permissions.denied : strings.permissions.prompt;

  return (
    <div className="flex items-center justify-between p-5 bg-white rounded-2xl border border-black/5">
      <span className="font-bold text-xs uppercase tracking-widest text-[#0f1a16]/60">{label}</span>
      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${colorClass}`}>
        {statusText}
      </span>
    </div>
  );
};

export const PermissionBanner: React.FC<{ onCheck: () => void }> = ({ onCheck }) => {
  const { cameraStatus, locationStatus } = usePermissions();
  
  // Prevent stutter: Only show if we explicitly know we are NOT healthy.
  // If either is 'unknown', we are still initializing, so we stay quiet.
  const isInitializing = cameraStatus === 'unknown' || locationStatus === 'unknown';
  const isHealthy = cameraStatus === 'granted' && locationStatus === 'granted';

  if (isInitializing || isHealthy) return null;

  return (
    <div className="bg-[#7c2d12] text-white px-6 py-3 flex items-center justify-between sticky top-0 z-[100] shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center space-x-3">
        <svg className="w-5 h-5 text-white/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-[10px] font-black uppercase tracking-widest leading-none">{strings.permissions.bannerText}</span>
      </div>
      <button 
        onClick={onCheck}
        className="bg-white text-[#7c2d12] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/90 transition-colors shadow-sm whitespace-nowrap ml-4"
      >
        {strings.permissions.checkBtn}
      </button>
    </div>
  );
};

export const PermissionModal: React.FC<PermissionModalProps> = ({ onClose }) => {
  const { cameraStatus, locationStatus, requestPermissions } = usePermissions();

  return (
    <div className="fixed inset-0 z-[1000] bg-[#f9fbfa] flex flex-col overflow-y-auto scroll-smooth-touch">
      <div className="min-h-full flex flex-col items-center justify-start p-6 pt-24 pb-20 text-center">
        <div className="max-w-md w-full space-y-10">
          <header className="space-y-4">
             <div className="w-20 h-20 bg-[#2d4239]/5 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
                <svg className="w-10 h-10 text-[#2d4239]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
             </div>
             <h2 className="text-3xl font-black uppercase tracking-tight text-[#0f1a16]">{strings.permissions.title}</h2>
             <p className="text-[#0f1a16]/40 text-sm font-medium leading-relaxed">{strings.permissions.desc}</p>
          </header>

          <div className="space-y-3">
            <StatusBadge status={cameraStatus} label={strings.permissions.camera} />
            <StatusBadge status={locationStatus} label={strings.permissions.location} />
          </div>

          {(cameraStatus === 'denied' || locationStatus === 'denied') && (
            <div className="space-y-4">
              <p className="text-[#7c2d12] text-[10px] font-bold uppercase tracking-widest bg-[#7c2d12]/5 p-5 rounded-2xl leading-loose">
                {strings.permissions.deniedInstruction}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4 pt-4">
            <button 
              onClick={async () => {
                await requestPermissions();
              }}
              className="w-full py-6 btn-sleek btn-sleek-pine !text-lg !tracking-[0.2em]"
            >
              {strings.permissions.requestBtn}
            </button>
            
            <button 
              onClick={onClose}
              className="text-[10px] font-black text-[#0f1a16]/30 hover:text-[#0f1a16] uppercase tracking-[0.4em] transition-colors py-4 mt-4"
            >
              {strings.common.back}
            </button>
          </div>
          
          <p className="text-[10px] font-medium text-[#0f1a16]/20 max-w-[280px] mx-auto leading-relaxed italic pb-12">
            {strings.permissions.limitedNote}
          </p>
        </div>
      </div>
    </div>
  );
};
