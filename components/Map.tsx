
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Location } from '../types';
import { useMapLayers } from '../hooks/useMapLayers';
import { strings } from '../i18n';

interface MapProps {
  onLocationSelect?: (loc: Location) => void;
  onViewChange?: (view: { center: Location, zoom: number }) => void;
  markers?: { position: Location; label?: string; icon?: 'default' | 'target' | 'user'; color?: string }[];
  center?: Location;
  zoom?: number;
  lines?: { from: Location; to: Location; color?: string }[];
  roundIndex?: number;
}

const isValid = (loc?: Location): boolean => {
  return !!loc && typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng);
};

const Map: React.FC<MapProps> = ({ 
  onLocationSelect, 
  onViewChange,
  markers = [], 
  center, 
  zoom = 13, 
  lines = [],
  roundIndex = 0
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [mapType, setMapType] = useState<'streets' | 'satellite'>(() => {
    try {
      return (localStorage.getItem('locateit_map_layer') as 'streets' | 'satellite') || 'streets';
    } catch {
      return 'streets';
    }
  });

  const tileLayersRef = useRef<{ base?: L.TileLayer; labels?: L.TileLayer }>({});

  const onLocationSelectRef = useRef(onLocationSelect);
  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  const onViewChangeRef = useRef(onViewChange);
  useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  useEffect(() => {
    if (!mapContainerRef.current || map) return;

    const startPos: [number, number] = isValid(center) ? [center!.lat, center!.lng] : [59.3293, 18.0686];

    const instance = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
      fadeAnimation: false,
      markerZoomAnimation: true,
      trackResize: true
    }).setView(startPos, zoom);

    L.control.zoom({ position: 'bottomright' }).addTo(instance);

    instance.on('click', (e) => {
      if (onLocationSelectRef.current) {
        onLocationSelectRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    instance.on('moveend', () => {
      if (onViewChangeRef.current) {
        const c = instance.getCenter();
        onViewChangeRef.current({ center: { lat: c.lat, lng: c.lng }, zoom: instance.getZoom() });
      }
    });

    // Use ResizeObserver to ensure map is valid whenever container changes size
    // This is the most reliable way to fix "first marker offset" in flexible layouts
    const resizeObserver = new ResizeObserver(() => {
      instance.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    setMap(instance);

    // Explicitly pulse invalidateSize to handle any entering transitions
    const pulses = [50, 250, 500, 1000];
    pulses.forEach(delay => {
      setTimeout(() => instance.invalidateSize(), delay);
    });

    return () => {
      resizeObserver.disconnect();
      instance.off();
      instance.remove();
      setMap(null);
    };
  }, []);

  // Manage tile layer swapping between Standard Map and Satellite Imagery
  useEffect(() => {
    if (!map) return;

    if (tileLayersRef.current.base) {
      tileLayersRef.current.base.remove();
    }
    if (tileLayersRef.current.labels) {
      tileLayersRef.current.labels.remove();
    }

    if (mapType === 'satellite') {
      // High-resolution Esri World Imagery (Orthophotos)
      const base = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri'
      }).addTo(map);

      // Boundaries & place names overlay for orientation in archipelago/islands
      const labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        opacity: 0.85
      }).addTo(map);

      tileLayersRef.current = { base, labels };
    } else {
      // Standard OpenStreetMap
      const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      tileLayersRef.current = { base };
    }

    try {
      localStorage.setItem('locateit_map_layer', mapType);
    } catch {}
  }, [map, mapType]);

  useEffect(() => {
    if (map && isValid(center)) {
      map.setView([center!.lat, center!.lng], zoom);
      setTimeout(() => map.invalidateSize(), 50);
    }
  }, [map, center?.lat, center?.lng, zoom, roundIndex]);

  useMapLayers(map, markers, lines, onLocationSelect);

  return (
    <div className="w-full h-full relative group bg-white">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Map Layer Switcher: Map vs Satellite */}
      <div 
        className="absolute top-3 right-3 z-[1000] flex items-center bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-xl border border-[#2d4239]/10 select-none pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMapType('streets');
          }}
          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 ${
            mapType === 'streets'
              ? 'bg-[#2d4239] text-white shadow-sm'
              : 'text-[#0f1a16]/60 hover:text-[#0f1a16] hover:bg-black/5'
          }`}
          title={strings.map.standardMapTooltip}
        >
          <span className="text-xs">🗺️</span>
          <span>{strings.map.standardMap}</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMapType('satellite');
          }}
          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 ${
            mapType === 'satellite'
              ? 'bg-[#2d4239] text-white shadow-sm'
              : 'text-[#0f1a16]/60 hover:text-[#0f1a16] hover:bg-black/5'
          }`}
          title={strings.map.satelliteTooltip}
        >
          <span className="text-xs">🛰️</span>
          <span>{strings.map.satellite}</span>
        </button>
      </div>

      <style>{`
        .nordic-tooltip {
          background: #ffffff;
          border: 1px solid rgba(45, 66, 57, 0.1);
          border-radius: 12px;
          padding: 6px 12px;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          box-shadow: 0 10px 20px -5px rgba(15, 26, 22, 0.1);
          color: #0f1a16;
        }
        .nordic-tooltip:before {
          border-top-color: #ffffff;
        }
        .leaflet-bottom.leaflet-right {
          bottom: 24px !important;
          right: 24px !important;
          z-index: 1000 !important;
        }
        .leaflet-bar {
          border: none !important;
          box-shadow: 0 10px 20px -5px rgba(15, 26, 22, 0.2) !important;
        }
        .leaflet-bar a {
          background-color: #ffffff !important;
          color: #0f1a16 !important;
          border: 1px solid rgba(15, 26, 22, 0.05) !important;
          border-radius: 12px !important;
          margin-bottom: 8px !important;
          width: 44px !important;
          height: 44px !important;
          line-height: 44px !important;
          font-weight: bold !important;
          font-size: 18px !important;
        }
        .leaflet-bar a:hover {
          background-color: #f9fbfa !important;
        }
      `}</style>
    </div>
  );
};

export default Map;
