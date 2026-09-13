import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Trail, Location, SpotGuess, TrailRun } from '../types';
import { calculateDistance, formatDistance } from '../utils';
import { strings } from '../i18n';
import Map from './Map';
import ImageOverlay from './ImageOverlay';
import { saveTrailRun, hasCompletedTrail, getCompletedTrailRun } from '../lib/trailRuns';

interface SoloPlayProps {
  trail: Trail;
  playerName: string;
  playerColor: string;
  onFinish: (run: TrailRun) => void;
  onExit: () => void;
}

const isValidLoc = (loc?: Location): boolean =>
  !!loc && typeof loc.lat === 'number' && !isNaN(loc.lat) && typeof loc.lng === 'number' && !isNaN(loc.lng);

const STORAGE_KEY_PREFIX = 'locateit_open_trail_progress_';

export const SoloPlay: React.FC<SoloPlayProps> = ({
  trail,
  playerName,
  playerColor,
  onFinish,
  onExit
}) => {
  const storageKey = `${STORAGE_KEY_PREFIX}${trail.id}`;

  // Restore saved state if available
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.currentIndex === 'number' && parsed.currentIndex < trail.questions.length) {
          return parsed.currentIndex;
        }
      }
    } catch {}
    return 0;
  });

  const [guesses, setGuesses] = useState<SpotGuess[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.guesses)) {
          return parsed.guesses;
        }
      }
    } catch {}
    return [];
  });

  const [selectedGuess, setSelectedGuess] = useState<Location | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const currGuess = (parsed.guesses as SpotGuess[])?.find(g => g.questionIndex === parsed.currentIndex);
        if (currGuess?.guess) return currGuess.guess;
      }
    } catch {}
    return null;
  });

  const [isLockedIn, setIsLockedIn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return (parsed.guesses as SpotGuess[])?.some(g => g.questionIndex === parsed.currentIndex) || false;
      }
    } catch {}
    return false;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreenImage, setIsFullscreenImage] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Dynamic map center & zoom override when locked in (auto-centering bounding box)
  const [activeMapView, setActiveMapView] = useState<{ center: Location; zoom: number } | null>(null);

  const currentQ = trail.questions[currentIndex];
  const isLastSpot = currentIndex === trail.questions.length - 1;

  // Persist progress to local storage on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        trailId: trail.id,
        currentIndex,
        guesses,
        updatedAt: Date.now()
      }));
    } catch {}
  }, [storageKey, trail.id, currentIndex, guesses]);

  // Calculate default map view
  const defaultMapConfig = useMemo(() => {
    if (trail.startingView && isValidLoc(trail.startingView.center)) {
      return trail.startingView;
    }
    const valid = trail.questions.filter(q => isValidLoc(q.location));
    if (valid.length === 0) return { center: { lat: 59.3293, lng: 18.0686 }, zoom: 12 };

    const lats = valid.map(q => q.location.lat);
    const lngs = valid.map(q => q.location.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };

    const maxDiff = Math.max(maxLat - minLat, maxLng - minLng);
    let zoom = 13;
    if (maxDiff > 0) {
      zoom = Math.floor(Math.log2(360 / maxDiff)) - 1;
      zoom = Math.max(3, Math.min(zoom, 16));
    } else {
      zoom = 15;
    }
    return { center, zoom };
  }, [trail]);

  // Auto-center on target + guess when locked in
  useEffect(() => {
    if (isLockedIn && selectedGuess && isValidLoc(currentQ?.location)) {
      const lat1 = selectedGuess.lat;
      const lng1 = selectedGuess.lng;
      const lat2 = currentQ.location.lat;
      const lng2 = currentQ.location.lng;

      const centerLat = (lat1 + lat2) / 2;
      const centerLng = (lng1 + lng2) / 2;
      const maxDiff = Math.max(Math.abs(lat1 - lat2), Math.abs(lng1 - lng2));

      let zoom = 15;
      if (maxDiff > 0.05) zoom = 11;
      else if (maxDiff > 0.02) zoom = 13;
      else if (maxDiff > 0.008) zoom = 14;
      else if (maxDiff > 0.002) zoom = 16;
      else zoom = 17;

      setActiveMapView({ center: { lat: centerLat, lng: centerLng }, zoom });
    } else {
      setActiveMapView(null);
    }
  }, [isLockedIn, selectedGuess, currentQ?.location]);

  // Handle locking in a guess
  const handleLockIn = useCallback(() => {
    if (!selectedGuess || !currentQ) return;
    const dist = calculateDistance(selectedGuess, currentQ.location);
    setIsLockedIn(true);

    const newGuess: SpotGuess = {
      questionIndex: currentIndex,
      guess: selectedGuess,
      distanceKm: dist
    };

    setGuesses(prev => {
      const filtered = prev.filter(g => g.questionIndex !== currentIndex);
      return [...filtered, newGuess];
    });
  }, [selectedGuess, currentQ, currentIndex]);

  // Handle advancing to the next spot or completing the run
  const handleNextSpot = useCallback(async () => {
    if (isLastSpot) {
      setIsSaving(true);
      // Ensure all spots have a guess in the array (fallback for any missed spot)
      let finalGuesses = [...guesses];
      if (selectedGuess && currentQ && !finalGuesses.some(g => g.questionIndex === currentIndex)) {
        const dist = calculateDistance(selectedGuess, currentQ.location);
        finalGuesses.push({
          questionIndex: currentIndex,
          guess: selectedGuess,
          distanceKm: dist
        });
      }

      const totalDist = finalGuesses.reduce((acc, g) => acc + g.distanceKm, 0);
      const res = await saveTrailRun({
        trailId: trail.id,
        playerName,
        playerColor,
        totalDistanceKm: totalDist,
        totalScore: Math.round(totalDist * 1000),
        guesses: finalGuesses
      });
      // Clear saved progress upon successful completion
      try {
        localStorage.removeItem(storageKey);
      } catch {}

      setIsSaving(false);
      if (res.run) {
        onFinish(res.run);
      }
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedGuess(null);
      setIsLockedIn(false);
      setActiveMapView(null);
    }
  }, [isLastSpot, guesses, selectedGuess, currentQ, currentIndex, trail.id, playerName, playerColor, onFinish, storageKey]);

  const isAlreadyDone = hasCompletedTrail(trail.id);
  const completedRun = isAlreadyDone ? getCompletedTrailRun(trail.id) : null;

  // Auto-redirect to leaderboard if already completed
  useEffect(() => {
    if (isAlreadyDone) {
      if (completedRun) {
        onFinish(completedRun);
      } else {
        onExit();
      }
    }
  }, [isAlreadyDone, completedRun, onFinish, onExit]);

  const handleLeaveGame = () => {
    // Keep in-progress saved state so player can resume where they left off
    onExit();
  };

  // Current spot distance result
  const currentGuess = guesses.find(g => g.questionIndex === currentIndex);
  const currentDistance = currentGuess ? currentGuess.distanceKm : (selectedGuess && currentQ ? calculateDistance(selectedGuess, currentQ.location) : 0);

  // Map markers
  const markers = useMemo(() => {
    if (!currentQ) return [];
    if (isLockedIn && selectedGuess) {
      return [
        { position: currentQ.location, label: strings.game.actualLocation, icon: 'target' as const },
        { position: selectedGuess, label: strings.game.playerGuessLabel(playerName), icon: 'user' as const, color: playerColor }
      ];
    }
    if (selectedGuess) {
      return [{ position: selectedGuess, label: strings.game.yourGuess, icon: 'user' as const, color: playerColor }];
    }
    return [];
  }, [isLockedIn, selectedGuess, currentQ, playerName, playerColor]);

  // Lines on map
  const lines = useMemo(() => {
    if (!currentQ) return [];
    if (isLockedIn && selectedGuess) {
      return [{ from: selectedGuess, to: currentQ.location, color: playerColor }];
    }
    return [];
  }, [isLockedIn, selectedGuess, currentQ, playerColor]);

  if (!currentQ) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f9fbfa] text-[#0f1a16]">
        <div className="text-center space-y-4">
          <p className="text-sm font-bold uppercase tracking-widest text-[#0f1a16]/60">{strings.solo.trailNotFound}</p>
          <button onClick={onExit} className="px-6 py-3 bg-[#2d4239] text-white rounded-2xl text-xs font-black uppercase tracking-widest">
            {strings.common.returnToMenu}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-[#f9fbfa] text-[#0f1a16] overflow-hidden select-none font-sans relative">
      {/* Fullscreen Image Overlay */}
      {isFullscreenImage && (
        <ImageOverlay 
          imageUrl={currentQ.imageUrl} 
          title={currentQ.title || strings.creator.spotPlaceholder(currentIndex + 1)} 
          onClose={() => setIsFullscreenImage(false)} 
        />
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[5000] bg-[#2d4239]/40 backdrop-blur-md flex items-center justify-center p-6 text-center animate-in fade-in duration-200">
          <div className="bg-white border border-black/5 p-8 rounded-[3rem] w-full max-w-sm shadow-2xl space-y-6">
            <div className="w-16 h-16 bg-[#7c2d12]/10 text-[#7c2d12] rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight text-[#0f1a16]">{strings.solo.leaveTitle}</h3>
              <p className="text-[#0f1a16]/60 text-sm mt-2 font-medium">{strings.solo.leaveDesc}</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowExitConfirm(false)} 
                className="flex-1 py-4 bg-[#f9fbfa] hover:bg-black/5 text-[#0f1a16] rounded-2xl font-bold text-xs uppercase tracking-widest transition-colors"
              >
                {strings.game.keepPlaying}
              </button>
              <button 
                onClick={handleLeaveGame} 
                className="flex-1 py-4 bg-[#7c2d12] hover:bg-[#60230e] text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-colors shadow-lg"
              >
                {strings.game.leaveBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Column: Image & Status Panel */}
      <div className="w-full md:w-1/2 h-[45vh] md:h-full flex flex-col border-b md:border-b-0 md:border-r border-black/5 bg-[#f9fbfa] z-10">
        <header className="p-4 md:p-6 flex justify-between items-center bg-white/40 backdrop-blur-md border-b border-black/5">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowExitConfirm(true)}
              className="p-2.5 rounded-xl bg-black/5 hover:bg-black/10 text-[#0f1a16]/60 hover:text-[#0f1a16] transition-colors"
              title={strings.solo.leaveTitle}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8c6b4f]">{strings.solo.title}</span>
              <h2 className="text-sm md:text-base font-black uppercase tracking-tight truncate max-w-[200px]">{trail.name}</h2>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="px-3 py-1.5 rounded-xl bg-[#2d4239]/10 text-[#2d4239] font-black text-xs uppercase tracking-wider">
              {currentIndex + 1} / {trail.questions.length}
            </div>
          </div>
        </header>

        {/* Photo Container */}
        <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center group">
          <img 
            src={currentQ.imageUrl} 
            alt="Target Spot" 
            className="w-full h-full object-contain cursor-pointer transition-transform duration-300 group-hover:scale-[1.01]"
            onClick={() => setIsFullscreenImage(true)}
          />
          <button 
            onClick={() => setIsFullscreenImage(true)}
            className="absolute bottom-4 right-4 p-3 bg-black/60 hover:bg-black/80 text-white rounded-2xl backdrop-blur-md shadow-lg transition-all"
            title={strings.creator.photoInspectTitle}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
          </button>
        </div>

        {/* Action / Result Bar */}
        <div className="p-4 md:p-6 bg-white border-t border-black/5 flex items-center justify-between gap-4">
          {!isLockedIn ? (
            <div className="flex-1 flex items-center justify-between gap-4">
              <span className="text-xs font-bold text-[#0f1a16]/60 uppercase tracking-wider">
                {selectedGuess ? strings.game.pinPlacedReady : strings.game.tapToPlacePin}
              </span>
              <button
                disabled={!selectedGuess}
                onClick={handleLockIn}
                className={`px-6 py-3.5 btn-sleek text-xs font-black uppercase tracking-widest ${selectedGuess ? 'btn-sleek-pine !bg-[#2d4239]' : 'bg-black/5 text-[#0f1a16]/20 cursor-not-allowed shadow-none'}`}
              >
                {strings.game.submitGuess}
              </button>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#8c6b4f]">{strings.game.accuracyLabel}</span>
                <p className="text-xl font-black uppercase tracking-tight text-[#2d4239]">
                  {strings.game.offDistance(formatDistance(currentDistance))}
                </p>
              </div>
              <button
                disabled={isSaving}
                onClick={handleNextSpot}
                className="px-8 py-3.5 btn-sleek btn-sleek-pine !bg-[#2d4239] text-xs font-black uppercase tracking-widest shadow-xl flex items-center space-x-2"
              >
                {isSaving ? (
                  <span>{strings.common.saving}</span>
                ) : (
                  <span>{isLastSpot ? strings.solo.seeLeaderboard : strings.game.nextLocation}</span>
                )}
                {!isSaving && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Interactive Map */}
      <div className="w-full md:w-1/2 h-[55vh] md:h-full relative bg-[#e5e7eb]">
        <Map
          onLocationSelect={isLockedIn ? undefined : (loc) => setSelectedGuess(loc)}
          markers={markers}
          lines={lines}
          center={activeMapView ? activeMapView.center : defaultMapConfig.center}
          zoom={activeMapView ? activeMapView.zoom : defaultMapConfig.zoom}
          roundIndex={currentIndex}
        />
      </div>
    </div>
  );
};

export default SoloPlay;
