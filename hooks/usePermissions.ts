import { useState, useEffect, useCallback } from 'react';

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export const usePermissions = () => {
  const [cameraStatus, setCameraStatus] = useState<PermissionState>('unknown');
  const [locationStatus, setLocationStatus] = useState<PermissionState>('unknown');

  const checkPermissions = useCallback(async () => {
    try {
      if (!('permissions' in navigator)) {
        setLocationStatus('prompt');
        setCameraStatus('prompt');
        return;
      }

      // Check Geolocation
      const geoPermission = await navigator.permissions.query({ name: 'geolocation' as any });
      setLocationStatus(geoPermission.state as PermissionState);
      geoPermission.onchange = () => setLocationStatus(geoPermission.state as PermissionState);

      // Camera permission query (Note: Not all browsers support querying 'camera')
      try {
        const camPermission = await navigator.permissions.query({ name: 'camera' as any });
        setCameraStatus(camPermission.state as PermissionState);
        camPermission.onchange = () => setCameraStatus(camPermission.state as PermissionState);
      } catch (e) {
        // Fallback for browsers that don't support camera permission query (e.g. Safari)
        setCameraStatus(prev => prev === 'unknown' ? 'prompt' : prev);
      }
    } catch (err) {
      console.warn('Permission query failed:', err);
      setLocationStatus(prev => prev === 'unknown' ? 'prompt' : prev);
      setCameraStatus(prev => prev === 'unknown' ? 'prompt' : prev);
    }
  }, []);

  const requestPermissions = useCallback(async () => {
    // Attempt camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(t => t.stop());
      setCameraStatus('granted');
    } catch (e: any) {
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
        console.warn("Camera access denied by user or environment policy.");
      } else {
        console.error("Camera request error:", e);
      }
      setCameraStatus('denied');
    }

    // Attempt location
    return new Promise<void>((resolve) => {
      if (!navigator.geolocation) {
        setLocationStatus('denied');
        resolve();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        () => {
          setLocationStatus('granted');
          resolve();
        },
        (err) => {
          console.warn("Location access denied or failed:", err.message);
          setLocationStatus('denied');
          resolve();
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }).then(() => {
      checkPermissions();
    });
  }, [checkPermissions]);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  return { cameraStatus, locationStatus, checkPermissions, requestPermissions };
};