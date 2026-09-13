import React, { useState, useEffect, useMemo } from 'react';
import { Trail, TrailRun, LeaderboardRanking, Location } from '../types';
import { formatDistance } from '../utils';
import { strings } from '../i18n';
import Map from './Map';
import ImageOverlay from './ImageOverlay';
import { TrailShareModal } from './TrailShareModal';
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
      // Show target icons for all spots
      return trail.questions.map((q, idx) => ({
        position: q.location,
        label: q.title || strings.creator.spotPlaceholder(idx + 1),
        icon: 'target' as const
      }));
    }

    const currentQ = trail.questions[selectedSpotIndex];
    const spotList = spotRankings.filter(s => s.guess);
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

    const playerMarkers = displayedRuns.map((s, idx) => {
      const isViewer = s.run.id === activeUserRunId;
      return {
        position: s.guess!,
        label: `${s.run.playerName} (${formatDistance(s.distanceKm)})`,
        icon: 'user' as const,
        color: s.run.playerColor
      };
    });

    return [targetMarker, ...playerMarkers];
  }, [selectedSpotIndex, trail.questions, spotRankings, showAllPins, activeUserRunId]);

  // Lines on map
  const lines = useMemo(() => {
    if (selectedSpotIndex === 'OVERALL') return [];
    const currentQ = trail.questions[selectedSpotIndex];
    const spotList = spotRankings.filter(s => s.guess);
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
  }, [selectedSpotIndex, trail.questions, spotRankings, showAllPins, activeUserRunId]);

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-[#f9fbfa] text-[#0f1a16] overflow-hidden select-none font-sans relative">
      {fullscreenImage && (
        <ImageOverlay 
          imageUrl={fullscreenImage} 
          title={strings.leaderboard.spotPhotoTitle} 
          onClose={() => setFullscreenImage(null)} 
        />
      )}

      {/* Left Column: Leaderboard Controls & Standings */}
      <div className="w-full md:w-[480px] lg:w-[540px] h-[55vh] md:h-full flex flex-col border-b md:border-b-0 md:border-r border-black/5 bg-[#f9fbfa] z-10 shadow-lg">
        {/* Header */}
        <header className="p-5 md:p-6 bg-white/60 backdrop-blur-md border-b border-black/5 flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <button 
              onClick={onExit}
              className="p-2.5 rounded-xl bg-black/5 hover:bg-black/10 text-[#0f1a16]/60 hover:text-[#0f1a16] transition-colors shrink-0"
              title={strings.common.back}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8c6b4f]">{strings.leaderboard.title}</span>
              <h2 className="text-base md:text-lg font-black uppercase tracking-tight truncate">{trail.name}</h2>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button 
              onClick={() => setShowShareModal(true)}
              className="p-2 rounded-xl bg-black/5 hover:bg-black/10 text-[#2d4239] transition-all shadow-sm"
              title={strings.leaderboard.shareBtnTooltip}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            </button>
            <button 
              onClick={onPlayAgain}
              className="px-4 py-2 bg-[#2d4239] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#1f2e27] transition-all shadow-md"
            >
              {strings.leaderboard.playTrailBtn}
            </button>
          </div>
        </header>

        {showShareModal && (
          <TrailShareModal 
            trail={trail}
            onClose={() => setShowShareModal(false)}
            onPlaySolo={onPlayAgain}
          />
        )}

        {/* Spot Selector Tabs (Carousel) */}
        <div className="px-4 py-3 bg-white/40 border-b border-black/5 flex items-center space-x-2 overflow-x-auto scroll-smooth-touch scrollbar-none">
          <button
            onClick={() => setSelectedSpotIndex('OVERALL')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 transition-all ${selectedSpotIndex === 'OVERALL' ? 'bg-[#2d4239] text-white shadow-md' : 'bg-black/5 text-[#0f1a16]/60 hover:bg-black/10'}`}
          >
            {strings.leaderboard.overallTab}
          </button>
          {trail.questions.map((q, idx) => (
            <button
              key={q.id || idx}
              onClick={() => setSelectedSpotIndex(idx)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 transition-all ${selectedSpotIndex === idx ? 'bg-[#8c6b4f] text-white shadow-md' : 'bg-black/5 text-[#0f1a16]/60 hover:bg-black/10'}`}
            >
              {strings.leaderboard.spotTab(idx + 1)}
            </button>
          ))}
        </div>

        {/* Scoring Method Toggle (Distance vs Points) */}
        {selectedSpotIndex === 'OVERALL' && (
          <div className="px-6 py-3 bg-[#f9fbfa] border-b border-black/5 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#0f1a16]/40">{strings.leaderboard.scoringMode}</span>
            <div className="flex bg-black/5 p-1 rounded-xl">
              <button
                onClick={() => setScoringTab('DISTANCE')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scoringTab === 'DISTANCE' ? 'bg-white text-[#2d4239] shadow-sm' : 'text-[#0f1a16]/40 hover:text-[#0f1a16]'}`}
              >
                {strings.leaderboard.totalDistance}
              </button>
              <button
                onClick={() => setScoringTab('POINTS')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${scoringTab === 'POINTS' ? 'bg-white text-[#8c6b4f] shadow-sm' : 'text-[#0f1a16]/40 hover:text-[#0f1a16]'}`}
              >
                {strings.leaderboard.relativePoints}
              </button>
            </div>
          </div>
        )}

        {/* Spot Detail View Banner */}
        {selectedSpotIndex !== 'OVERALL' && (
          <div className="p-4 bg-white/60 border-b border-black/5 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <img 
                src={trail.questions[selectedSpotIndex].imageUrl} 
                alt="Spot" 
                onClick={() => setFullscreenImage(trail.questions[selectedSpotIndex].imageUrl)}
                className="w-12 h-12 rounded-xl object-cover border border-black/10 cursor-pointer hover:opacity-80 transition-opacity" 
              />
              <div>
                <p className="text-xs font-black uppercase text-[#0f1a16]">{strings.leaderboard.spotSiteLabel(selectedSpotIndex + 1)}</p>
                <p className="text-[10px] font-bold text-[#0f1a16]/40 uppercase tracking-widest">
                  {trail.questions[selectedSpotIndex].title || strings.leaderboard.targetSite}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAllPins(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${showAllPins ? 'bg-[#2d4239] text-white border-transparent' : 'border-black/10 text-[#0f1a16]/60 hover:bg-black/5'}`}
            >
              {showAllPins ? strings.leaderboard.allPinsShown : strings.leaderboard.top3Pins}
            </button>
          </div>
        )}

        {/* Rankings Table Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 scroll-smooth-touch relative">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 text-[#2d4239]/40 font-black text-xs uppercase tracking-widest">
              <div className="w-8 h-8 border-3 border-[#2d4239] border-t-transparent rounded-full animate-spin"></div>
              <span>{strings.leaderboard.fetching}</span>
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center space-y-3 whitespace-pre-line">
              <svg className="w-12 h-12 text-[#2d4239]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
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
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isViewer ? 'ring-2 ring-[#2d4239] bg-[#2d4239]/5 border-[#2d4239]/20 shadow-md' : isPodium ? 'bg-white border-black/5 shadow-sm' : 'bg-white/40 border-black/5'}`}
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <span className={`text-sm font-black w-6 text-center ${rank === 1 ? 'text-[#ca8a04]' : rank === 2 ? 'text-[#64748b]' : rank === 3 ? 'text-[#b45309]' : 'text-black/30'}`}>
                      #{rank}
                    </span>
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-xs shadow-sm border border-white/20 shrink-0" 
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
                          <span className="px-1.5 py-0.5 rounded-md bg-[#2d4239] text-white text-[8px] font-black uppercase tracking-widest">
                            {strings.leaderboard.youBadge}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-[#0f1a16]/40 font-bold uppercase tracking-widest">
                        {new Date(r.run.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {scoringTab === 'DISTANCE' ? (
                      <>
                        <p className="text-sm font-black text-[#2d4239] uppercase tracking-tight">
                          {formatDistance(r.run.totalDistanceKm)}
                        </p>
                        <p className="text-[9px] font-bold text-[#0f1a16]/40 uppercase tracking-widest">
                          {strings.leaderboard.totalError}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-black text-[#8c6b4f] uppercase tracking-tight">
                          {r.calculatedPoints} {strings.leaderboard.pts}
                        </p>
                        <p className="text-[9px] font-bold text-[#0f1a16]/40 uppercase tracking-widest">
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
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${isViewer ? 'ring-2 ring-[#2d4239] bg-[#2d4239]/5 border-[#2d4239]/20 shadow-md' : 'bg-white border-black/5'}`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className={`text-xs font-black w-5 text-center ${rank === 1 ? 'text-[#ca8a04]' : 'text-black/30'}`}>
                      #{rank}
                    </span>
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-xs shadow-sm border border-white/20 shrink-0" 
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
                  <div className="text-right">
                    <p className="text-xs font-black text-[#2d4239] uppercase tracking-tight">
                      {s.distanceKm !== Infinity ? formatDistance(s.distanceKm) : strings.leaderboard.noGuess}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Viewer Rank Footer (If viewer exists and is lower in standings) */}
        {userRanking && selectedSpotIndex === 'OVERALL' && (
          <footer className="p-4 bg-white/90 backdrop-blur-md border-t border-black/5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div 
                className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-xs shadow-sm" 
                style={{ backgroundColor: userRanking.run.playerColor }}
              >
                {(userRanking.run.playerName || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8c6b4f]">{strings.leaderboard.yourPlacement}</p>
                <p className="text-xs font-black uppercase tracking-tight text-[#0f1a16]">
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

      {/* Right Column: Interactive Map */}
      <div className="w-full md:flex-1 h-[45vh] md:h-full relative bg-[#e5e7eb]">
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
