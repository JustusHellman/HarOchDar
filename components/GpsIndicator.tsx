import React from 'react';
import { strings } from '../i18n';

interface GpsIndicatorProps {
  accuracy: number | null;
  isDisabled?: boolean;
}

const GpsIndicator: React.FC<GpsIndicatorProps> = ({ accuracy, isDisabled }) => {
  // Accuracy categories in meters
  const isExcellent = !isDisabled && accuracy !== null && accuracy < 10;
  const isGood = !isDisabled && accuracy !== null && accuracy >= 10 && accuracy < 30;
  const isPoor = !isDisabled && accuracy !== null && accuracy >= 30;
  const isNone = !isDisabled && accuracy === null;

  const getStatusColor = () => {
    if (isDisabled) return 'bg-transparent border border-[#0f1a16]/10';
    if (isExcellent) return 'bg-[#10b981]';
    if (isGood) return 'bg-[#f59e0b]';
    if (isPoor) return 'bg-[#7c2d12]';
    return 'bg-[#0f1a16]/10';
  };

  const getStatusText = () => {
    if (isDisabled) return strings.creator.gpsSignal.disabled;
    if (isExcellent) return strings.creator.gpsSignal.excellent;
    if (isGood) return strings.creator.gpsSignal.good;
    if (isPoor) return strings.creator.gpsSignal.poor;
    return strings.creator.gpsSignal.none;
  };

  return (
    <div className="flex items-center space-x-3 bg-white/50 backdrop-blur-md px-4 py-2 rounded-2xl border border-black/5 shadow-sm">
      <div className="flex space-x-0.5 items-end h-3">
        <div className={`w-1 h-1 rounded-full ${!isDisabled && accuracy !== null ? getStatusColor() : 'bg-[#0f1a16]/10'}`} />
        <div className={`w-1 h-2 rounded-full ${!isDisabled && accuracy !== null && !isPoor ? getStatusColor() : 'bg-[#0f1a16]/10'}`} />
        <div className={`w-1 h-3 rounded-full ${!isDisabled && isExcellent ? getStatusColor() : 'bg-[#0f1a16]/10'}`} />
      </div>
      <div className="flex flex-col">
        <span className={`text-[8px] font-black uppercase tracking-widest ${isNone ? 'animate-pulse' : ''} ${isDisabled ? 'opacity-30' : ''}`}>
          {getStatusText()}
        </span>
        {!isDisabled && accuracy !== null && (
          <span className="text-[7px] font-bold text-[#0f1a16]/40 uppercase tracking-widest">
            {strings.creator.gpsAccuracy(accuracy)}
          </span>
        )}
      </div>
    </div>
  );
};

export default GpsIndicator;