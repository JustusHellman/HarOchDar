import React, { useState, useRef, useEffect, TouchEvent } from 'react';
import { strings } from '../i18n';

interface ImageOverlayProps {
  imageUrl: string;
  title?: string;
  onClose: () => void;
}

const ImageOverlay: React.FC<ImageOverlayProps> = ({ imageUrl, title, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Touch state for pinch-to-zoom
  const initialDistance = useRef<number | null>(null);
  const initialZoom = useRef<number>(1);

  const handleZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoom(prev => Math.min(prev + 0.5, 4));
  };
  
  const handleZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoom(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom === 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch handlers
  const getDistance = (touches: React.TouchList) => {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      if (zoom > 1) {
        setIsDragging(true);
        setDragStart({ x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y });
      }
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      initialDistance.current = getDistance(e.touches);
      initialZoom.current = zoom;
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1 && isDragging && zoom > 1) {
      setOffset({ 
        x: e.touches[0].clientX - dragStart.x, 
        y: e.touches[0].clientY - dragStart.y 
      });
    } else if (e.touches.length === 2 && initialDistance.current !== null) {
      const currentDistance = getDistance(e.touches);
      const distanceDelta = currentDistance / initialDistance.current;
      const nextZoom = Math.max(1, Math.min(initialZoom.current * distanceDelta, 4));
      
      setZoom(nextZoom);
      if (nextZoom === 1) {
        setOffset({ x: 0, y: 0 });
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    initialDistance.current = null;
  };

  // Prevent default scroll behavior
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[2000] bg-black/95 flex items-center justify-center p-0 animate-in fade-in zoom-in duration-300 overflow-hidden touch-none" 
      onMouseMove={handleMouseMove} 
      onMouseUp={handleMouseUp} 
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {title && (
        <div className="absolute top-8 left-8 z-[2010] max-w-[60%] sm:max-w-md bg-white/10 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 text-white truncate">
          <span className="text-xs font-black uppercase tracking-wider block truncate">{title}</span>
        </div>
      )}
      <div className="absolute top-8 right-8 z-[2010] flex space-x-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-1 flex items-center border border-white/10">
          <button onClick={handleZoomOut} className="p-4 text-white hover:text-[#8c6b4f] transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
          </button>
          <span className="text-white/40 text-[10px] font-black uppercase tracking-widest px-2">{zoom.toFixed(1)}x</span>
          <button onClick={handleZoomIn} className="p-4 text-white hover:text-[#8c6b4f] transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
        <button onClick={onClose} className="p-4 bg-white text-[#0f1a16] rounded-full shadow-2xl hover:scale-110 transition-transform">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div 
        className={`w-full h-full flex items-center justify-center ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`} 
        onMouseDown={handleMouseDown}
      >
        <img 
          src={imageUrl} 
          className="max-w-full max-h-full object-contain shadow-2xl transition-transform duration-100 ease-out" 
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, pointerEvents: 'none' }} 
        />
      </div>
    </div>
  );
};

export default ImageOverlay;