import React, { useRef, useEffect, useState } from 'react';
import GpsIndicator from './GpsIndicator';
import { strings } from '../i18n';

interface CameraViewProps {
  onCapture: (video: HTMLVideoElement) => void;
  onClose: () => void;
  gpsAccuracy: number | null;
  locationStatus: string;
  isProcessing: boolean;
  isFlashing: boolean;
}

const CameraView: React.FC<CameraViewProps> = ({ 
  onCapture, 
  onClose, 
  gpsAccuracy, 
  locationStatus, 
  isProcessing, 
  isFlashing 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isCancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("Camera API not supported in this browser.");
        onCloseRef.current();
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1920 } } 
        });
        if (isCancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access failed", err);
        onCloseRef.current();
      }
    }
    startCamera();
    return () => {
      isCancelled = true;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0f1a16] flex flex-col overflow-hidden">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="flex-1 w-full h-full object-cover" 
      />
      {isFlashing && <div className="fixed inset-0 bg-white z-[110] animate-flash pointer-events-none"></div>}
      <div className="absolute top-8 left-0 right-0 px-8 flex justify-center z-[120]">
         <GpsIndicator accuracy={gpsAccuracy} isDisabled={locationStatus === 'denied'} />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-12 flex justify-between items-center bg-gradient-to-t from-black/80 via-black/20 to-transparent">
        <button onClick={onClose} className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center border border-white/20 active:scale-90 transition-transform">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <button 
          onClick={() => {
            if (videoRef.current && videoRef.current.videoWidth > 0 && !isProcessing) {
              onCapture(videoRef.current);
            }
          }} 
          disabled={isProcessing} 
          className="w-24 h-24 rounded-full bg-white border-[8px] border-white/30 shadow-2xl active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
        >
          {isProcessing ? (
            <div className="w-10 h-10 border-4 border-[#0f1a16] border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <div className="w-14 h-14 rounded-full border-4 border-[#f9fbfa]"></div>
          )}
        </button>
        <div className="w-16 h-16" />
      </div>
    </div>
  );
};

export default CameraView;