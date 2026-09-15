import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Trail, Location, SpotGuess, TrailRun } from '../types';
import { calculateDistance, formatDistance } from '../utils';
import { strings } from '../i18n';
import Map from './Map';
import ImageOverlay from './ImageOverlay';
import { saveTrailRun, hasCompletedTrail, getCompletedTrailRun, loadTrailRuns } from '../lib/trailRuns';

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

  const [runs, setRuns] = useState<TrailRun[]>([]);
  const [showAllPins, setShowAllPins] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreenImage, setIsFullscreenImage] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Dynamic map center & zoom override when locked in (auto-centering bounding box)
  const [activeMapView, setActiveMapView] = useState<{ center: Location; zoom: number } | null>(null);

  const currentQ = trail.questions[currentIndex];
  const isLastSpot = currentIndex === trail.questions.length - 1;

  // Load other players' historical runs for this trail
  useEffect(() => {
    let isMounted = true;
    loadTrailRuns(trail.id).then(data => {
      if (isMounted) {
        setRuns(data);
      }
    });
    return () => { isMounted = false; };
  }, [trail.id]);

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
      setShowAllPins(false);
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

  // Spot Leaderboard comparing current live guess against all other historical runs on this spot
  const spotLeaderboard = useMemo(() => {
    if (!isLockedIn || !selectedGuess || !currentQ) return [];

    const list: {
      id: string;
      name: string;
      color: string;
      distanceKm: number;
      guess: Location;
      isViewer: boolean;
    }[] = [];

    // Current viewer's active guess
    list.push({
      id: 'current_user_live',
      name: playerName,
      color: playerColor,
      distanceKm: currentDistance,
      guess: selectedGuess,
      isViewer: true
    });

    // Historical runs from other players
    runs.forEach(r => {
      if (r.playerName.trim().toLowerCase() === playerName.trim().toLowerCase()) return;
      const g = r.guesses?.find(guess => guess.questionIndex === currentIndex);
      if (g && g.guess && isValidLoc(g.guess)) {
        list.push({
          id: r.id,
          name: r.playerName,
          color: r.playerColor || '#6366f1',
          distanceKm: g.distanceKm,
          guess: g.guess,
          isViewer: false
        });
      }
    });

    // Sort closest first
    return list.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [isLockedIn, selectedGuess, currentQ, playerName, playerColor, currentDistance, runs, currentIndex]);

  const viewerRank = spotLeaderboard.findIndex(item => item.isViewer) + 1;
  const totalSpotPlayers = spotLeaderboard.length;

  // Map markers: Target + Top 3 (or All) + Current Viewer
  const markers = useMemo(() => {
    if (!currentQ) return [];
    if (!isLockedIn) {
      if (selectedGuess) {
        return [{ position: selectedGuess, label: strings.game.yourGuess, icon: 'user' as const, color: playerColor }];
      }
      return [];
    }

    const targetMarker = {
      position: currentQ.location,
      label: strings.leaderboard.actualSpotLabel || strings.game.actualLocation,
      icon: 'target' as const
    };

    const displayedList = showAllPins ? spotLeaderboard : spotLeaderboard.slice(0, 3);
    const viewerItem = spotLeaderboard.find(s => s.isViewer);
    if (!showAllPins && viewerItem && !displayedList.some(d => d.id === viewerItem.id)) {
      displayedList.push(viewerItem);
    }

    const playerMarkers = displayedList.map(s => ({
      position: s.guess,
      label: s.isViewer ? strings.game.yourGuess : s.name,
      icon: (s.isViewer ? 'user' : 'default') as 'user' | 'default',
      color: s.color
    }));

    return [targetMarker, ...playerMarkers];
  }, [currentQ, isLockedIn, selectedGuess, playerColor, showAllPins, spotLeaderboard]);

  // Connection lines to target
  const lines = useMemo(() => {
    if (!currentQ || !isLockedIn) return [];
    const displayedList = showAllPins ? spotLeaderboard : spotLeaderboard.slice(0, 3);
    const viewerItem = spotLeaderboard.find(s => s.isViewer);
    if (!showAllPins && viewerItem && !displayedList.some(d => d.id === viewerItem.id)) {
      displayedList.push(viewerItem);
    }

    return displayedList.map(s => ({
      from: s.guess,
      to: currentQ.location,
      color: s.color
    }));
  }, [currentQ, isLockedIn, showAllPins, spotLeaderboard]);

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

      {/* Left Column: Image & Results / Controls Panel */}
      <div className="w-full md:w-1/2 h-[50vh] md:h-full flex flex-col border-b md:border-b-0 md:border-r border-black/5 bg-[#f9fbfa] z-10 shrink-0">
        <header className="p-3.5 sm:p-5 flex justify-between items-center bg-white/60 backdrop-blur-md border-b border-black/5 shrink-0">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowExitConfirm(true)}
              className="p-2 rounded-xl bg-black/5 hover:bg-black/10 text-[#0f1a16]/60 hover:text-[#0f1a16] transition-colors"
              title={strings.solo.leaveTitle}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8c6b4f]">{strings.solo.title}</span>
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-tight truncate max-w-[180px] sm:max-w-[240px]">{trail.name}</h2>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="px-3 py-1.5 rounded-xl bg-[#2d4239]/10 text-[#2d4239] font-black text-xs uppercase tracking-wider">
              {currentIndex + 1} / {trail.questions.length}
            </div>
          </div>
        </header>

        {/* Photo Container */}
        <div className={`relative overflow-hidden bg-black flex items-center justify-center group transition-all duration-300 ${isLockedIn ? 'h-36 sm:h-44 md:h-52 shrink-0' : 'flex-1'}`}>
          <img 
            src={currentQ.imageUrl} 
            alt="Target Spot" 
            className="w-full h-full object-contain cursor-pointer transition-transform duration-300 group-hover:scale-[1.01]"
            onClick={() => setIsFullscreenImage(true)}
          />
          <button 
            onClick={() => setIsFullscreenImage(true)}
            className="absolute bottom-3 right-3 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-xl backdrop-blur-md shadow-lg transition-all"
            title={strings.creator.photoInspectTitle}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
          </button>
        </div>

        {/* Action / Results Panel */}
        {!isLockedIn ? (
          <div className="p-4 sm:p-6 bg-white border-t border-black/5 flex items-center justify-between gap-4 shrink-0">
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
          <div className="flex-1 min-h-0 flex flex-col bg-[#f9fbfa] overflow-hidden">
            {/* Accuracy & Pin Toggle Bar */}
            <div className="p-4 sm:p-5 bg-white border-y border-black/5 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#8c6b4f]">{strings.game.accuracyLabel}</span>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#2d4239]">
                    {strings.game.offDistance(formatDistance(currentDistance))}
                  </p>
                  {totalSpotPlayers > 1 && (
                    <span className="text-xs font-black px-2 py-0.5 rounded-full bg-[#2d4239]/10 text-[#2d4239]">
                      #{viewerRank} / {totalSpotPlayers}
                    </span>
                  )}
                </div>
              </div>

              {/* Toggle: Top 3 vs All Pins */}
              {spotLeaderboard.length > 3 && (
                <button
                  onClick={() => setShowAllPins(!showAllPins)}
                  className="px-3.5 py-2 rounded-xl bg-[#f9fbfa] hover:bg-black/5 border border-black/5 text-[#0f1a16] font-bold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5"
                >
                  <span>📍</span>
                  <span>{showAllPins ? strings.leaderboard.allPinsShown : strings.leaderboard.top3Pins}</span>
                </button>
              )}
            </div>

            {/* Spot Standings List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-2.5 scroll-smooth-touch">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#0f1a16]/40 mb-1">
                {strings.leaderboard.spotSiteLabel(currentIndex + 1)} · {strings.leaderboard.title}
              </div>

              {spotLeaderboard.map((item, rankIdx) => {
                const isViewer = item.isViewer;
                const isTop3 = rankIdx < 3;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      isViewer 
                        ? 'bg-[#2d4239]/5 border-[#2d4239]/20 shadow-sm' 
                        : 'bg-white border-black/5 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                        rankIdx === 0 
                          ? 'bg-amber-400 text-amber-950 shadow-sm' 
                          : rankIdx === 1 
                            ? 'bg-slate-300 text-slate-800' 
                            : rankIdx === 2 
                              ? 'bg-amber-700/20 text-amber-900' 
                              : 'bg-black/5 text-[#0f1a16]/40'
                      }`}>
                        {rankIdx + 1}
                      </div>

                      <div className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />

                      <span className={`text-xs font-black uppercase truncate ${isViewer ? 'text-[#2d4239]' : 'text-[#0f1a16]'}`}>
                        {item.name} {isViewer && `(${strings.leaderboard.youBadge})`}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-[#8c6b4f] tracking-tight">
                        {formatDistance(item.distanceKm)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Advance Button Footer */}
            <div className="p-4 sm:p-5 bg-white border-t border-black/5 flex justify-end shrink-0">
              <button
                disabled={isSaving}
                onClick={handleNextSpot}
                className="w-full sm:w-auto px-8 py-3.5 btn-sleek btn-sleek-pine !bg-[#2d4239] text-xs font-black uppercase tracking-widest shadow-xl flex items-center justify-center space-x-2"
              >
                {isSaving ? (
                  <span>{strings.common.saving}</span>
                ) : (
                  <span>{isLastSpot ? strings.solo.seeLeaderboard : strings.game.nextLocation}</span>
                )}
                {!isSaving && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Interactive Map */}
      <div className="w-full md:w-1/2 h-[50vh] md:h-full relative bg-[#e5e7eb]">
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

