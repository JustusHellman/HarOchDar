import React, { useState, useEffect, useMemo } from 'react';
import { Trail, TrailRun, LeaderboardRanking, Location } from '../types';
import { formatDistance } from '../utils';
import { strings } from '../i18n';
import Map from './Map';
import ImageOverlay from './ImageOverlay';
import { TrailShareModal } from './TrailShareModal';
import { HowToPlayModal } from './HowToPlayModal';
import { loadTrailRuns, calculateLeaderboard } from '../lib/trailRuns';

interface TrailLeaderboardProps {
  trail: Trail;
  currentRunId?: string;
  onPlayAgain: () => void;
  onExit: () => void;
}

const isValidLoc = (loc?: Location): boolean =>
  !!loc && typeof loc.lat === 'number' && !isNaN(loc.lat) && typeof loc.lng === 'number' && !isNaN(loc.lng);

const TrailLeaderboard: React.FC<TrailLeaderboardProps> = ({
  trail,
  currentRunId,
  onPlayAgain,
  onExit
}) => {
  const [runs, setRuns] = useState<TrailRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scoringTab, setScoringTab] = useState<'DISTANCE' | 'POINTS'>('DISTANCE');
  const [selectedSpotIndex, setSelectedSpotIndex] = useState<number | 'OVERALL'>('OVERALL');
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showAllPins, setShowAllPins] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  // Load runs on mount
  useEffect(() => {
    let isMounted = true;
    async function fetchRuns() {
      setIsLoading(true);
      const data = await loadTrailRuns(trail.id);
      if (isMounted) {
        setRuns(data);
        setIsLoading(false);
      }
    }
    fetchRuns();
    return () => { isMounted = false; };
  }, [trail.id]);

  // Compute dual rankings
  const rankings: LeaderboardRanking[] = useMemo(() => {
    return calculateLeaderboard(runs, trail.questions.length);
  }, [runs, trail.questions.length]);

  // Sorted rankings based on active tab
  const sortedRankings = useMemo(() => {
    if (scoringTab === 'DISTANCE') {
      return [...rankings].sort((a, b) => a.distanceRank - b.distanceRank);
    } else {
      return [...rankings].sort((a, b) => a.pointRank - b.pointRank);
    }
  }, [rankings, scoringTab]);

  // Current viewer run
  const activeUserRunId = currentRunId || localStorage.getItem(`locateit_last_run_${trail.id}`);
  const userRanking = rankings.find(r => r.run.id === activeUserRunId);
  const activeUserRun = userRanking?.run || runs.find(r => r.id === activeUserRunId);

  // Map view config
  const mapConfig = useMemo(() => {
    if (selectedSpotIndex !== 'OVERALL') {
      const q = trail.questions[selectedSpotIndex];
      if (isValidLoc(q.location)) {
        return { center: q.location, zoom: 16 };
      }
    }
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
    return {
      center: { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 },
      zoom: 13
    };
  }, [trail, selectedSpotIndex]);

  // Spot-specific rankings when a single spot is selected
  const spotRankings = useMemo(() => {
    if (selectedSpotIndex === 'OVERALL') return [];
    return runs.map(r => {
      const g = r.guesses.find(guess => guess.questionIndex === selectedSpotIndex);
      return {
        run: r,
        guess: g?.guess,
        distanceKm: g !== undefined ? g.distanceKm : Infinity
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [selectedSpotIndex, runs]);

  // Dynamic Markers
  const markers = useMemo(() => {
    if (selectedSpotIndex === 'OVERALL') {
      const allMarkers: { position: Location; label?: string; icon?: 'default' | 'target' | 'user'; color?: string }[] = [];

      // 1. Target spots for all questions in the trail
      trail.questions.forEach((q, idx) => {
        if (isValidLoc(q.location)) {
          allMarkers.push({
            position: q.location,
            label: `${idx + 1}. ${q.title || strings.creator.spotPlaceholder(idx + 1)}`,
            icon: 'target' as const
          });
        }
      });

      // 2. The active player's guesses for each spot (omit other players on overall view to avoid clutter)
      if (activeUserRun?.guesses) {
        activeUserRun.guesses.forEach((g) => {
          if (g.guess && isValidLoc(g.guess)) {
            const spotNum = g.questionIndex + 1;
            allMarkers.push({
              position: g.guess,
              label: `${strings.game.yourGuess} (${strings.creator.spotPlaceholder(spotNum)}: ${formatDistance(g.distanceKm)})`,
              icon: 'user' as const,
              color: activeUserRun.playerColor || '#2d4239'
            });
          }
        });
      }

      return allMarkers;
    }

    const currentQ = trail.questions[selectedSpotIndex];
    if (!currentQ || !isValidLoc(currentQ.location)) return [];

    const spotList = spotRankings.filter(s => s.guess && isValidLoc(s.guess));
    const targetMarker = {
      position: currentQ.location,
      label: strings.leaderboard.actualSpotLabel,
      icon: 'target' as const
    };

    // Filter which player pins to show:
    // Always include target + user pin + top 3 pins (or all if toggled)
    const displayedRuns = showAllPins ? spotList : spotList.slice(0, 3);
    
    // Ensure current user's pin is included if not in top 3
    const userSpotItem = spotList.find(s => s.run.id === activeUserRunId);
    if (!showAllPins && userSpotItem && !displayedRuns.some(d => d.run.id === userSpotItem.run.id)) {
      displayedRuns.push(userSpotItem);
    }

    const playerMarkers = displayedRuns.map((s) => {
      const isViewer = s.run.id === activeUserRunId;
      return {
        position: s.guess!,
        label: isViewer 
          ? `${strings.game.yourGuess} (${formatDistance(s.distanceKm)})`
          : `${s.run.playerName} (${formatDistance(s.distanceKm)})`,
        icon: (isViewer ? 'user' : 'default') as 'user' | 'default',
        color: s.run.playerColor
      };
    });

    return [targetMarker, ...playerMarkers];
  }, [selectedSpotIndex, trail.questions, spotRankings, showAllPins, activeUserRunId, activeUserRun]);

  // Lines on map
  const lines = useMemo(() => {
    if (selectedSpotIndex === 'OVERALL') {
      if (!activeUserRun?.guesses) return [];
      return activeUserRun.guesses
        .filter(g => g.guess && isValidLoc(g.guess) && trail.questions[g.questionIndex] && isValidLoc(trail.questions[g.questionIndex].location))
        .map(g => ({
          from: g.guess!,
          to: trail.questions[g.questionIndex].location,
          color: activeUserRun.playerColor || '#2d4239'
        }));
    }

    const currentQ = trail.questions[selectedSpotIndex];
    if (!currentQ || !isValidLoc(currentQ.location)) return [];

    const spotList = spotRankings.filter(s => s.guess && isValidLoc(s.guess));
    const displayedRuns = showAllPins ? spotList : spotList.slice(0, 3);

    const userSpotItem = spotList.find(s => s.run.id === activeUserRunId);
    if (!showAllPins && userSpotItem && !displayedRuns.some(d => d.run.id === userSpotItem.run.id)) {
      displayedRuns.push(userSpotItem);
    }

    return displayedRuns.map(s => ({
      from: s.guess!,
      to: currentQ.location,
      color: s.run.playerColor
    }));
  }, [selectedSpotIndex, trail.questions, spotRankings, showAllPins, activeUserRunId, activeUserRun]);

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-[#f9fbfa] text-[#0f1a16] overflow-hidden select-none font-sans relative">
      {showHowToPlay && (
        <HowToPlayModal onClose={() => setShowHowToPlay(false)} />
      )}

      {fullscreenImage && (
        <ImageOverlay 
          imageUrl={fullscreenImage} 
          title={strings.leaderboard.spotPhotoTitle} 
          onClose={() => setFullscreenImage(null)} 
        />
      )}

      {showShareModal && (
        <TrailShareModal 
          trail={trail}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Left Column: Leaderboard Controls & Standings */}
      <div className="w-full md:w-[420px] lg:w-[460px] h-[52vh] md:h-full flex flex-col border-b md:border-b-0 md:border-r border-black/5 bg-[#f9fbfa] z-10 shadow-lg">
        {/* Compact Header */}
        <header className="px-4 py-2.5 bg-white/70 backdrop-blur-md border-b border-black/5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <button 
              onClick={onExit}
              className="p-2 rounded-xl bg-black/5 hover:bg-black/10 text-[#0f1a16]/60 hover:text-[#0f1a16] transition-colors shrink-0"
              title={strings.common.back}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-md bg-[#8c6b4f]/10 text-[#8c6b4f] text-[9px] font-black uppercase tracking-wider">
                  {strings.leaderboard.title}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-tight truncate text-[#0f1a16]">
                {trail.name}
              </h2>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 shrink-0">
            <button 
              onClick={() => setShowHowToPlay(true)}
              className="p-2 rounded-xl bg-black/5 hover:bg-black/10 text-[#0f1a16]/60 hover:text-[#0f1a16] transition-all shadow-xs flex items-center justify-center"
              title={strings.howToPlay.buttonLabel}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            <button 
              onClick={() => setShowShareModal(true)}
              className="p-2 rounded-xl bg-black/5 hover:bg-black/10 text-[#2d4239] transition-all shadow-xs flex items-center gap-1"
              title={strings.leaderboard.shareBtnTooltip}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            </button>
          </div>
        </header>

        {/* Spot Selector Tabs (Carousel) */}
        <div className="px-3 py-2 bg-white/40 border-b border-black/5 flex items-center space-x-1.5 overflow-x-auto scroll-smooth-touch scrollbar-none shrink-0">
          <button
            onClick={() => setSelectedSpotIndex('OVERALL')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider shrink-0 transition-all ${selectedSpotIndex === 'OVERALL' ? 'bg-[#2d4239] text-white shadow-sm' : 'bg-black/5 text-[#0f1a16]/60 hover:bg-black/10'}`}
          >
            {strings.leaderboard.overallTab}
          </button>
          {trail.questions.map((q, idx) => (
            <button
              key={q.id || idx}
              onClick={() => setSelectedSpotIndex(idx)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider shrink-0 transition-all ${selectedSpotIndex === idx ? 'bg-[#8c6b4f] text-white shadow-sm' : 'bg-black/5 text-[#0f1a16]/60 hover:bg-black/10'}`}
            >
              {strings.leaderboard.spotTab(idx + 1)}
            </button>
          ))}
        </div>

        {/* Scoring Method Toggle (Distance vs Points) */}
        {selectedSpotIndex === 'OVERALL' && (
          <div className="px-4 py-2 bg-[#f9fbfa] border-b border-black/5 flex items-center justify-between shrink-0">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0f1a16]/40">{strings.leaderboard.scoringMode}</span>
            <div className="flex bg-black/5 p-0.5 rounded-xl">
              <button
                onClick={() => setScoringTab('DISTANCE')}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${scoringTab === 'DISTANCE' ? 'bg-white text-[#2d4239] shadow-sm' : 'text-[#0f1a16]/40 hover:text-[#0f1a16]'}`}
              >
                {strings.leaderboard.totalDistance}
              </button>
              <button
                onClick={() => setScoringTab('POINTS')}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${scoringTab === 'POINTS' ? 'bg-white text-[#8c6b4f] shadow-sm' : 'text-[#0f1a16]/40 hover:text-[#0f1a16]'}`}
              >
                {strings.leaderboard.relativePoints}
              </button>
            </div>
          </div>
        )}

        {/* Spot Detail View Banner */}
        {selectedSpotIndex !== 'OVERALL' && (
          <div className="px-4 py-2 bg-white/60 border-b border-black/5 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center space-x-2.5 min-w-0">
              <img 
                src={trail.questions[selectedSpotIndex].imageUrl} 
                alt="Spot" 
                onClick={() => setFullscreenImage(trail.questions[selectedSpotIndex].imageUrl)}
                className="w-9 h-9 rounded-lg object-cover border border-black/10 cursor-pointer hover:opacity-80 transition-opacity shrink-0" 
              />
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase text-[#0f1a16] leading-tight truncate">
                  {strings.leaderboard.spotSiteLabel(selectedSpotIndex + 1)}
                </p>
                <p className="text-[9px] font-bold text-[#0f1a16]/50 uppercase tracking-wider truncate">
                  {trail.questions[selectedSpotIndex].title || strings.leaderboard.targetSite}
                </p>
              </div>
            </div>
            <button
              onClick={() => setFullscreenImage(trail.questions[selectedSpotIndex].imageUrl)}
              className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#8c6b4f] hover:bg-[#8c6b4f]/10 rounded-lg transition-colors shrink-0"
            >
              {strings.game.viewSpotPhoto}
            </button>
          </div>
        )}

        {/* Rankings Table Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 scroll-smooth-touch relative">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-[#2d4239]/40 font-black text-xs uppercase tracking-widest">
              <div className="w-6 h-6 border-2 border-[#2d4239] border-t-transparent rounded-full animate-spin"></div>
              <span>{strings.leaderboard.fetching}</span>
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 opacity-30 text-center space-y-2 whitespace-pre-line">
              <svg className="w-10 h-10 text-[#2d4239]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <p className="font-bold uppercase tracking-widest text-xs">{strings.leaderboard.noRunsRecorded}</p>
            </div>
          ) : selectedSpotIndex === 'OVERALL' ? (
            // Overall List
            sortedRankings.map((r) => {
              const isViewer = r.run.id === activeUserRunId;
              const rank = scoringTab === 'DISTANCE' ? r.distanceRank : r.pointRank;
              const isPodium = rank <= 3;
              
              return (
                <div 
                  key={r.run.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isViewer ? 'ring-2 ring-[#2d4239] bg-[#2d4239]/5 border-[#2d4239]/20 shadow-sm' : isPodium ? 'bg-white border-black/5 shadow-xs' : 'bg-white/40 border-black/5'}`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className={`text-xs font-black w-5 text-center shrink-0 ${rank === 1 ? 'text-[#ca8a04]' : rank === 2 ? 'text-[#64748b]' : rank === 3 ? 'text-[#b45309]' : 'text-black/30'}`}>
                      #{rank}
                    </span>
                    <div 
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-xs shadow-xs border border-white/20 shrink-0" 
                      style={{ backgroundColor: r.run.playerColor }}
                    >
                      {(r.run.playerName || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-black text-xs uppercase tracking-tight text-[#0f1a16] truncate max-w-[130px]">
                          {r.run.playerName}
                        </span>
                        {isViewer && (
                          <span className="px-1 py-0.5 rounded bg-[#2d4239] text-white text-[7.5px] font-black uppercase tracking-widest">
                            {strings.leaderboard.youBadge}
                          </span>
                        )}
                      </div>
                      <span className="text-[8.5px] text-[#0f1a16]/40 font-bold uppercase tracking-wider block">
                        {new Date(r.run.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {scoringTab === 'DISTANCE' ? (
                      <>
                        <p className="text-xs sm:text-sm font-black text-[#2d4239] uppercase tracking-tight">
                          {formatDistance(r.run.totalDistanceKm)}
                        </p>
                        <p className="text-[8px] font-bold text-[#0f1a16]/40 uppercase tracking-widest">
                          {strings.leaderboard.totalError}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs sm:text-sm font-black text-[#8c6b4f] uppercase tracking-tight">
                          {r.calculatedPoints} {strings.leaderboard.pts}
                        </p>
                        <p className="text-[8px] font-bold text-[#0f1a16]/40 uppercase tracking-widest">
                          {strings.leaderboard.spotWins(r.spotWins)}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            // Spot-by-Spot List
            spotRankings.map((s, idx) => {
              const isViewer = s.run.id === activeUserRunId;
              const rank = idx + 1;
              return (
                <div 
                  key={s.run.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${isViewer ? 'ring-2 ring-[#2d4239] bg-[#2d4239]/5 border-[#2d4239]/20 shadow-sm' : 'bg-white border-black/5'}`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className={`text-xs font-black w-5 text-center shrink-0 ${rank === 1 ? 'text-[#ca8a04]' : 'text-black/30'}`}>
                      #{rank}
                    </span>
                    <div 
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-xs shadow-xs border border-white/20 shrink-0" 
                      style={{ backgroundColor: s.run.playerColor }}
                    >
                      {(s.run.playerName || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="font-black text-xs uppercase tracking-tight text-[#0f1a16] truncate max-w-[140px] block">
                        {s.run.playerName} {isViewer && `(${strings.leaderboard.youBadge})`}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-[#2d4239] uppercase tracking-tight">
                      {s.distanceKm !== Infinity ? formatDistance(s.distanceKm) : strings.leaderboard.noGuess}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Viewer Rank Footer */}
        {userRanking && selectedSpotIndex === 'OVERALL' && (
          <footer className="px-4 py-2.5 bg-white/90 backdrop-blur-md border-t border-black/5 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2.5">
              <div 
                className="w-7 h-7 rounded-xl flex items-center justify-center font-black text-white text-xs shadow-xs" 
                style={{ backgroundColor: userRanking.run.playerColor }}
              >
                {(userRanking.run.playerName || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[#8c6b4f]">{strings.leaderboard.yourPlacement}</p>
                <p className="text-[11px] font-black uppercase tracking-tight text-[#0f1a16]">
                  {strings.leaderboard.rankOf(scoringTab === 'DISTANCE' ? userRanking.distanceRank : userRanking.pointRank, runs.length)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-[#2d4239] uppercase tracking-tight">
                {scoringTab === 'DISTANCE' ? formatDistance(userRanking.run.totalDistanceKm) : `${userRanking.calculatedPoints} ${strings.leaderboard.pts}`}
              </p>
            </div>
          </footer>
        )}
      </div>

      {/* Right Column: Interactive Map with Floating Top 3 / All Toggle */}
      <div className="w-full md:flex-1 h-[48vh] md:h-full relative bg-[#e5e7eb]">
        {selectedSpotIndex !== 'OVERALL' && spotRankings.length > 3 && (
          <div className="absolute top-3 left-3 z-[1000] pointer-events-auto">
            <button
              onClick={() => setShowAllPins(!showAllPins)}
              className="px-2.5 py-1.5 rounded-xl bg-white/95 hover:bg-white text-[#0f1a16] shadow-lg border border-[#2d4239]/15 backdrop-blur-md font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 select-none"
              title={showAllPins ? strings.leaderboard.allPinsShown : strings.leaderboard.top3Pins}
            >
              <span className="w-2 h-2 rounded-full border-2 border-[#2d4239] bg-[#2d4239] inline-block shrink-0"></span>
              <span>{showAllPins ? strings.leaderboard.allPinsShown : strings.leaderboard.top3Pins}</span>
            </button>
          </div>
        )}
        <Map
          markers={markers}
          lines={lines}
          center={mapConfig.center}
          zoom={mapConfig.zoom}
          roundIndex={typeof selectedSpotIndex === 'number' ? selectedSpotIndex : 999}
        />
      </div>
    </div>
  );
};

export default TrailLeaderboard;
