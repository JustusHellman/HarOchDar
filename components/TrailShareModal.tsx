import React, { useState } from 'react';
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react';
import { Trail } from '../types';
import { strings } from '../i18n';

interface TrailShareModalProps {
  trail: Trail;
  onClose: () => void;
  onPlaySolo?: () => void;
}

export const TrailShareModal: React.FC<TrailShareModalProps> = ({
  trail,
  onClose,
  onPlaySolo
}) => {
  const [copied, setCopied] = useState(false);
  
  // Direct shareable Solo URL
  const soloUrl = `${window.location.origin}${window.location.pathname}?solo=${trail.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(soloUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-[#2d4239]/40 backdrop-blur-md flex items-center justify-center p-6 text-center animate-in fade-in duration-200 select-none">
      <div className="bg-white border border-black/5 p-8 sm:p-10 rounded-[3rem] w-full max-w-md shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="text-left">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8c6b4f]">{strings.share.title}</span>
            <h3 className="text-2xl font-black uppercase tracking-tight text-[#0f1a16] truncate max-w-[260px]">{trail.name}</h3>
            <p className="text-xs font-bold text-[#0f1a16]/40 uppercase tracking-widest mt-0.5">{strings.share.spotsCountSubtitle(trail.questions.length)}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-black/5 hover:bg-black/10 text-[#0f1a16]/60 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* QR Code Container */}
        <div className="bg-[#f9fbfa] p-6 rounded-[2.5rem] border border-black/5 flex flex-col items-center justify-center space-y-4 shadow-inner">
          <div className="p-4 bg-white rounded-3xl shadow-sm border border-black/5">
            <QRCodeSVG 
              value={soloUrl} 
              size={180} 
              level="H"
              includeMargin={false}
              fgColor="#0f1a16"
            />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2d4239]/60">
            {strings.share.scanQrInstruction}
          </p>
        </div>

        {/* Share Link & Actions */}
        <div className="space-y-3">
          <button 
            onClick={handleCopyLink}
            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center space-x-2 ${copied ? 'bg-[#10b981] text-white' : 'bg-[#2d4239] hover:bg-[#1f2e27] text-white'}`}
          >
            {copied ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                <span>{strings.share.linkCopied}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                <span>{strings.share.copyLinkBtn}</span>
              </>
            )}
          </button>

          {onPlaySolo && (
            <button 
              onClick={() => { onClose(); onPlaySolo(); }}
              className="w-full py-3.5 bg-[#f9fbfa] hover:bg-[#8c6b4f]/10 text-[#8c6b4f] rounded-2xl font-black text-xs uppercase tracking-widest transition-colors border border-black/5 flex items-center justify-center space-x-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{strings.share.playMyselfBtn}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
