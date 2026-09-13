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

      const bgColor = m.color || (m.icon === 'target' ? '#ef4444' : m.icon === 'user' ? '#3b82f6' : '#6366f1');
      
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-all duration-300" style="background-color: ${bgColor}">
          <div class="w-2.5 h-2.5 rounded-full bg-white/80"></div>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([m.position.lat, m.position.lng], { 
        icon, 
        draggable: !!onLocationSelect 
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
          offset: [0, -10]
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