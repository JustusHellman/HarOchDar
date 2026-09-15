import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Location } from '../types';

interface MarkerData {
  position: Location;
  label?: string;
  icon?: 'default' | 'target' | 'user';
  color?: string;
}

interface LineData {
  from: Location;
  to: Location;
  color?: string;
}

const isValid = (loc?: Location): boolean => 
  !!loc && typeof loc.lat === 'number' && !isNaN(loc.lat) && typeof loc.lng === 'number' && !isNaN(loc.lng);

export const useMapLayers = (
  map: L.Map | null,
  markers: MarkerData[],
  lines: LineData[],
  onLocationSelect?: (loc: Location) => void
) => {
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize LayerGroup once map is ready
  useEffect(() => {
    if (!map) return;
    layerGroupRef.current = L.layerGroup().addTo(map);
    return () => {
      layerGroupRef.current?.remove();
      layerGroupRef.current = null;
    };
  }, [map]);

  // Sync Markers and Lines
  useEffect(() => {
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    
    const bounds = L.latLngBounds([]);

    markers.forEach((m) => {
      if (!isValid(m.position)) return;

      const bgColor = m.color || (m.icon === 'target' ? '#dc2626' : m.icon === 'user' ? '#3b82f6' : '#6366f1');
      const isTarget = m.icon === 'target';
      const isUser = m.icon === 'user';

      let html = '';
      let iconSize: [number, number] = [28, 28];
      let iconAnchor: [number, number] = [14, 14];
      let zIndexOffset = 500;

      if (isTarget) {
        iconSize = [32, 32];
        iconAnchor = [16, 16];
        zIndexOffset = 3000;
        html = `
          <div class="relative flex items-center justify-center select-none" style="transform: translate(-50%, -50%);">
            <!-- Pulsing outer halo -->
            <div class="absolute -inset-1.5 rounded-full bg-red-500/40 animate-ping pointer-events-none"></div>
            <!-- Target Marker Circle -->
            <div class="relative w-8 h-8 rounded-full bg-[#dc2626] border-2 border-white shadow-lg flex items-center justify-center transition-transform hover:scale-110">
              <div class="w-2.5 h-2.5 rounded-full bg-white"></div>
            </div>
          </div>
        `;
      } else if (isUser) {
        iconSize = [32, 32];
        iconAnchor = [16, 16];
        zIndexOffset = 2000;
        html = `
          <div class="relative flex items-center justify-center select-none" style="transform: translate(-50%, -50%);">
            <!-- Player Marker Circle in Player Color -->
            <div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-transform hover:scale-110" style="background-color: ${bgColor}; box-shadow: 0 0 0 2px ${bgColor}40, 0 4px 12px rgba(0,0,0,0.25);">
              <div class="w-2.5 h-2.5 rounded-full bg-white"></div>
            </div>
          </div>
        `;
      } else {
        iconSize = [28, 28];
        iconAnchor = [14, 14];
        zIndexOffset = 500;
        html = `
          <div class="relative flex items-center justify-center select-none" style="transform: translate(-50%, -50%);">
            <div class="w-7 h-7 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-transform hover:scale-110" style="background-color: ${bgColor}">
              <div class="w-2 h-2 rounded-full bg-white/90"></div>
            </div>
          </div>
        `;
      }

      const icon = L.divIcon({
        className: 'custom-div-icon',
        html,
        iconSize,
        iconAnchor,
      });

      const marker = L.marker([m.position.lat, m.position.lng], { 
        icon, 
        draggable: !!onLocationSelect,
        zIndexOffset
      }).addTo(layerGroup);

      if (onLocationSelect) {
        marker.on('dragend', (event) => {
          const { lat, lng } = event.target.getLatLng();
          onLocationSelect({ lat, lng });
        });
      }

      if (m.label) {
        marker.bindTooltip(m.label, { 
          permanent: false, 
          direction: 'top', 
          className: 'nordic-tooltip',
          offset: [0, -12]
        });
      }
      
      bounds.extend([m.position.lat, m.position.lng]);
    });

    lines.forEach((line) => {
      if (!isValid(line.from) || !isValid(line.to)) return;

      L.polyline(
        [[line.from.lat, line.from.lng], [line.to.lat, line.to.lng]],
        { 
          color: line.color || '#6366f1', 
          weight: 4, 
          dashArray: '10, 15',
          opacity: 0.8,
          lineCap: 'round'
        }
      ).addTo(layerGroup);
      
      bounds.extend([line.from.lat, line.from.lng]);
      bounds.extend([line.to.lat, line.to.lng]);
    });

    // Fit bounds if we have significant map data (Host seeing guesses or Results screen)
    if (bounds.isValid() && (markers.length > 1 || lines.length > 0)) {
      // Force a slight delay to ensure UI transitions have settled
      setTimeout(() => {
        if (map) {
          map.invalidateSize();
          map.fitBounds(bounds, { 
            padding: [80, 80], 
            maxZoom: 15, 
            animate: true,
            duration: 1.0
          });
        }
      }, 100);
    }
  }, [map, markers, lines, onLocationSelect]);
};