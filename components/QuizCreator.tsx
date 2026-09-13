import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Question, Location, Trail } from "../types";
import { generateId, compressImage } from "../utils";
import { strings } from "../i18n";
import GpsIndicator from "./GpsIndicator";
import { usePermissions } from "../hooks/usePermissions";
import { PermissionBanner } from "./PermissionGate";
import CameraView from "./CameraView";
import SpotEditor from "./SpotEditor";
import StartingViewEditor from "./StartingViewEditor";
import SpotList from "./SpotList";
import { supabase } from "../lib/supabase";
// @ts-ignore
import ExifReader from "exifreader";
import {
  saveDraft,
  getDraft,
  clearDraft,
  formatDraftTime,
  TrailDraft,
} from "../lib/draftStorage";

const STOCKHOLM: Location = { lat: 59.3293, lng: 18.0686 };

interface QuizCreatorProps {
  onComplete: (
    questions: Question[],
    name: string,
    startingView?: { center: Location; zoom: number },
  ) => void;
  onCancel: () => void;
  onRequestPermissions: () => void;
  initialTrail?: Trail;
  isSaving?: boolean;
}

const LoadingOverlay: React.FC<{ message: string }> = ({ message }) => (
  <div className="fixed inset-0 z-[1000] bg-white/80 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300">
    <div className="w-16 h-16 border-4 border-[#2d4239] border-t-transparent rounded-full animate-spin mb-6"></div>
    <p className="font-black uppercase tracking-[0.3em] text-[#2d4239] text-xs text-center px-6">
      {message}
    </p>
  </div>
);

const QuizCreator: React.FC<QuizCreatorProps> = ({
  onComplete,
  onCancel,
  onRequestPermissions,
  initialTrail,
  isSaving,
}) => {
  const { cameraStatus, locationStatus } = usePermissions();
  const [questions, setQuestions] = useState<Question[]>(
    initialTrail?.questions || [],
  );
  const [trailName, setTrailName] = useState(initialTrail?.name || "");
  const [startingView, setStartingView] = useState<
    { center: Location; zoom: number } | undefined
  >(initialTrail?.startingView);

  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [isFlashing, setIsFlashing] = useState(false);

  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isSettingView, setIsSettingView] = useState(false);
  const [creatorError, setCreatorError] = useState<string | null>(null);

  // Local draft auto-recovery states
  const [savedDraftPrompt, setSavedDraftPrompt] = useState<TrailDraft | null>(
    null,
  );
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const [pendingQuestion, setPendingQuestion] = useState<{
    localDataUrl: string;
    location: Location;
    originalLocation: Location;
    source: "IMAGE" | "GPS" | "DEFAULT" | "MANUAL";
    editingId?: string;
    title?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const watchId = useRef<number | null>(null);

  // Check for an existing local draft on mount
  useEffect(() => {
    const draft = getDraft(initialTrail?.id);
    if (
      draft &&
      draft.questions &&
      (draft.questions.length > 0 || (draft.name && draft.name.trim() !== ""))
    ) {
      const initialQuestions = initialTrail?.questions || [];
      const initialName = initialTrail?.name || "";
      const isDifferent =
        draft.name !== initialName ||
        draft.questions.length !== initialQuestions.length ||
        draft.questions.some((q, idx) => {
          const iq = initialQuestions[idx];
          return (
            !iq ||
            q.id !== iq.id ||
            q.title !== iq.title ||
            q.location.lat !== iq.location.lat ||
            q.location.lng !== iq.location.lng
          );
        });
      if (isDifferent) {
        setSavedDraftPrompt(draft);
      }
    }
  }, [initialTrail?.id]);

  const hasChanges = useMemo(() => {
    const initialQuestions = initialTrail?.questions || [];
    const initialName = initialTrail?.name || "";
    if (trailName !== initialName) return true;
    if (questions.length !== initialQuestions.length) return true;
    return questions.some((q, idx) => {
      const iq = initialQuestions[idx];
      return (
        !iq ||
        q.id !== iq.id ||
        q.title !== iq.title ||
        q.location.lat !== iq.location.lat ||
        q.location.lng !== iq.location.lng
      );
    });
  }, [questions, trailName, initialTrail]);

  // Continuously auto-save draft locally on any change
  useEffect(() => {
    if (savedDraftPrompt) return;

    // Only auto-save if we have at least one question or non-empty name
    if (questions.length === 0 && (!trailName || trailName.trim() === "")) {
      return;
    }

    if (hasChanges) {
      setIsAutoSaving(true);
      const timer = setTimeout(() => {
        saveDraft({
          trailId: initialTrail?.id,
          name: trailName,
          questions,
          startingView,
          savedAt: Date.now(),
        });
        setLastSaved(Date.now());
        setIsAutoSaving(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    questions,
    trailName,
    startingView,
    hasChanges,
    initialTrail?.id,
    savedDraftPrompt,
  ]);

  // Continuously watch position to have it ready
  useEffect(() => {
    if (!navigator.geolocation || locationStatus === "denied") return;
    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
    const success = (pos: GeolocationPosition) => {
      setCurrentLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      setGpsAccuracy(pos.coords.accuracy);
    };
    const handleError = (err: any) => {
      console.warn("GPS Watch Error:", err.message);
    };
    watchId.current = navigator.geolocation.watchPosition(
      success,
      handleError,
      options,
    );
    return () => {
      if (watchId.current !== null)
        navigator.geolocation.clearWatch(watchId.current);
    };
  }, [locationStatus]);

  // Helper to get the most reliable live location available right now
  const getBestLiveLocation = async (): Promise<{
    loc: Location;
    source: "GPS" | "DEFAULT";
  }> => {
    // 1. Check if our background watcher already has a lock
    if (currentLocation) {
      console.log("Using cached watch location:", currentLocation);
      return { loc: currentLocation, source: "GPS" };
    }

    // 2. If granted but no lock, try a one-time high-accuracy burst (3s timeout)
    if (locationStatus === "granted") {
      console.log("No watch lock yet, attempting high-accuracy burst...");
      try {
        const pos = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 3000,
              maximumAge: 0,
            });
          },
        );
        const liveLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(liveLoc); // Update cache for next time
        setGpsAccuracy(pos.coords.accuracy);
        return { loc: liveLoc, source: "GPS" };
      } catch (err) {
        console.warn("High-accuracy burst failed, falling back to Stockholm.");
      }
    }

    // 3. Last resort: Stockholm
    return { loc: STOCKHOLM, source: "DEFAULT" };
  };

  const uploadImageToStorage = async (dataUrl: string): Promise<string> => {
    if (dataUrl.startsWith("http://") || dataUrl.startsWith("https://")) {
      return dataUrl;
    }

    let blob: Blob;
    try {
      const res = await fetch(dataUrl);
      blob = await res.blob();
    } catch {
      const base64 = dataUrl.split(",")[1];
      if (!base64) return dataUrl;
      const byteCharacters = atob(base64);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      blob = new Blob([byteNumbers], { type: "image/jpeg" });
    }

    const fileName = `${generateId()}.jpg`;
    const { error } = await supabase.storage
      .from("trail-images")
      .upload(fileName, blob);

    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from("trail-images").getPublicUrl(fileName);

    return publicUrl;
  };

  const deleteImageFromStorage = async (url: string) => {
    try {
      if (url.startsWith("data:")) return;
      const fileName = url.split("/").pop();
      if (fileName) {
        await supabase.storage.from("trail-images").remove([fileName]);
      }
    } catch (err) {
      console.error("Failed to cleanup image:", err);
    }
  };

  const handleCapture = async (video: HTMLVideoElement) => {
    setProcessingMessage(strings.creator.processing);
    setIsProcessing(true);
    setIsFlashing(true);
    try {
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;
      const clientWidth = video.clientWidth || window.innerWidth;
      const clientHeight = video.clientHeight || window.innerHeight;

      const streamRatio = vWidth / vHeight;
      const containerRatio = clientWidth / clientHeight;

      let sx = 0, sy = 0, sWidth = vWidth, sHeight = vHeight;

      if (streamRatio > containerRatio) {
        // Stream is wider than container: crop left/right
        sWidth = vHeight * containerRatio;
        sx = (vWidth - sWidth) / 2;
      } else {
        // Stream is taller than container: crop top/bottom
        sHeight = vWidth / containerRatio;
        sy = (vHeight - sHeight) / 2;
      }

      const canvas = document.createElement("canvas");
      canvas.width = sWidth;
      canvas.height = sHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
        const rawUrl = canvas.toDataURL("image/jpeg", 0.9);
        const compressedUrl = await compressImage(rawUrl);

        // Use our robust location helper
        const { loc, source } = await getBestLiveLocation();

        setPendingQuestion({
          localDataUrl: compressedUrl,
          location: loc,
          originalLocation: loc,
          source: source,
        });
        setIsCapturing(false);
      }
    } catch (err) {
      console.error("Capture failed:", err);
      setCreatorError(strings.creator.processingError);
    } finally {
      setIsFlashing(false);
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProcessingMessage(strings.creator.processing);
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawUrl = event.target?.result as string;
        const imageUrl = await compressImage(rawUrl);

        let exifLat: number | null = null;
        let exifLng: number | null = null;

        try {
          const tags = await ExifReader.load(file);
          if (tags.GPSLatitude && tags.GPSLongitude) {
            let lat = parseFloat(tags.GPSLatitude.description);
            let lng = parseFloat(tags.GPSLongitude.description);
            const latRef = tags.GPSLatitudeRef
              ? String(
                  (tags.GPSLatitudeRef as any).value ||
                    tags.GPSLatitudeRef.description ||
                    "",
                ).toUpperCase()
              : "";
            const lngRef = tags.GPSLongitudeRef
              ? String(
                  (tags.GPSLongitudeRef as any).value ||
                    tags.GPSLongitudeRef.description ||
                    "",
                ).toUpperCase()
              : "";
            if (latRef.startsWith("S") && lat > 0) lat = -lat;
            if (lngRef.startsWith("W") && lng > 0) lng = -lng;
            exifLat = lat;
            exifLng = lng;
          }
        } catch (exifErr) {
          console.warn("Exif read failed or no GPS data in image.");
        }

        let finalLoc = STOCKHOLM;
        let finalSource: "IMAGE" | "GPS" | "DEFAULT" = "DEFAULT";

        // 1. Priority: EXIF data from the file itself
        if (
          exifLat !== null &&
          exifLng !== null &&
          !isNaN(exifLat) &&
          !isNaN(exifLng)
        ) {
          finalLoc = { lat: exifLat, lng: exifLng };
          finalSource = "IMAGE";
          console.log("Using EXIF location from file:", finalLoc);
        } else {
          // 2. Priority: Live GPS location
          const { loc, source } = await getBestLiveLocation();
          finalLoc = loc;
          finalSource = source;
          console.log(`Using ${source} location for file upload.`);
        }

        setPendingQuestion({
          localDataUrl: imageUrl,
          location: finalLoc,
          originalLocation: finalLoc,
          source: finalSource,
        });
      } catch (err) {
        console.error("Upload process failed:", err);
        setCreatorError(strings.creator.uploadError);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const confirmPending = async () => {
    if (!pendingQuestion) return;
    setProcessingMessage(strings.creator.finalizingSpot);
    setIsProcessing(true);
    try {
      let finalUrl = pendingQuestion.localDataUrl;
      if (pendingQuestion.localDataUrl.startsWith("data:")) {
        try {
          finalUrl = await uploadImageToStorage(pendingQuestion.localDataUrl);
        } catch (uploadErr) {
          console.warn(
            "Could not upload photo immediately (offline/poor connection). Storing locally for draft recovery.",
            uploadErr,
          );
          // Keep localDataUrl so the spot is preserved in the local draft and can be uploaded on finalize
          finalUrl = pendingQuestion.localDataUrl;
        }
      }

      const isMoved =
        Math.abs(
          pendingQuestion.location.lat - pendingQuestion.originalLocation.lat,
        ) > 0.000001 ||
        Math.abs(
          pendingQuestion.location.lng - pendingQuestion.originalLocation.lng,
        ) > 0.000001;
      const finalSource = isMoved ? "MANUAL" : pendingQuestion.source;

      if (pendingQuestion.editingId) {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === pendingQuestion.editingId
              ? {
                  ...q,
                  location: pendingQuestion.location,
                  imageUrl: finalUrl,
                  locationSource: finalSource,
                  title: pendingQuestion.title || q.title,
                }
              : q,
          ),
        );
      } else {
        setQuestions((prev) => [
          ...prev,
          {
            id: generateId(),
            imageUrl: finalUrl,
            location: pendingQuestion.location,
            locationSource: finalSource,
            title: strings.creator.spotPlaceholder(prev.length + 1),
          },
        ]);
      }
      setPendingQuestion(null);
    } catch (err) {
      console.error("Failed to confirm spot:", err);
      setCreatorError(strings.creator.spotProcessError);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSpot = async () => {
    if (confirmDeleteId) {
      const q = questions.find((question) => question.id === confirmDeleteId);
      // ONLY delete from cloud storage if it was newly uploaded in this session and wasn't part of the existing published trail
      const isOriginalImage = initialTrail?.questions.some(
        (iq) => iq.imageUrl === q?.imageUrl,
      );
      if (q && !isOriginalImage && !q.imageUrl.startsWith("data:")) {
        await deleteImageFromStorage(q.imageUrl);
      }
      setQuestions((prev) => prev.filter((q) => q.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    }
  };

  if (isSettingView) {
    return (
      <StartingViewEditor
        initialView={startingView}
        questions={questions}
        onSave={(view) => {
          setStartingView(view);
          setIsSettingView(false);
        }}
        onCancel={() => setIsSettingView(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f9fbfa] flex flex-col text-[#0f1a16] selection:bg-[#8c6b4f]/20">
      {(isProcessing || isSaving) && (
        <LoadingOverlay
          message={
            isSaving ? strings.creator.publishingTrail : processingMessage
          }
        />
      )}

      {pendingQuestion ? (
        <SpotEditor
          pendingQuestion={{
            imageUrl: pendingQuestion.localDataUrl,
            location: pendingQuestion.location,
            editingId: pendingQuestion.editingId,
          }}
          onUpdateLocation={(loc) =>
            setPendingQuestion((prev) =>
              prev ? { ...prev, location: loc } : null,
            )
          }
          onConfirm={confirmPending}
          onCancel={() => setPendingQuestion(null)}
        />
      ) : isCapturing ? (
        <CameraView
          onCapture={handleCapture}
          onClose={() => setIsCapturing(false)}
          gpsAccuracy={gpsAccuracy}
          locationStatus={locationStatus}
          isProcessing={isProcessing}
          isFlashing={isFlashing}
        />
      ) : (
        <>
          <PermissionBanner onCheck={onRequestPermissions} />
          <header className="px-6 pt-12 pb-8 shrink-0 bg-white/70 backdrop-blur-xl sticky top-0 z-30 border-b border-[#2d4239]/5">
            <div className="max-w-4xl mx-auto flex justify-between items-start">
              <div className="flex-1 mr-4">
                <input
                  type="text"
                  placeholder={strings.creator.trailNamePlaceholder}
                  value={trailName}
                  onChange={(e) => setTrailName(e.target.value)}
                  className="bg-transparent border-none text-3xl font-black focus:ring-0 p-0 w-full placeholder-[#0f1a16]/10 tracking-tight uppercase text-[#0f1a16]"
                />
                <div className="flex items-center space-x-3 mt-2 flex-wrap gap-y-1">
                  <p className="text-[#8c6b4f] font-black uppercase text-[9px] tracking-[0.4em]">
                    {strings.creator.spotsInTrail(questions.length)}
                  </p>
                  <div className="w-1 h-1 rounded-full bg-[#0f1a16]/10" />
                  <GpsIndicator
                    accuracy={gpsAccuracy}
                    isDisabled={locationStatus === "denied"}
                  />
                  {(lastSaved || isAutoSaving) && (
                    <>
                      <div className="w-1 h-1 rounded-full bg-[#0f1a16]/10" />
                      <div className="flex items-center space-x-1.5 text-[#2d4239] font-black text-[9px] uppercase tracking-widest animate-in fade-in duration-300">
                        {isAutoSaving ? (
                          <>
                            <div className="w-2.5 h-2.5 border-2 border-[#2d4239] border-t-transparent rounded-full animate-spin" />
                            <span className="opacity-70">
                              {strings.creator.savingDraft}
                            </span>
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-3 h-3 text-[#2d4239]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span>{strings.creator.draftSaved}</span>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() =>
                  hasChanges ? setShowExitConfirm(true) : onCancel()
                }
                className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-black/5 hover:bg-white transition-all shadow-sm text-[#0f1a16]"
              >
                {strings.common.cancel}
              </button>
            </div>
          </header>

          <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6 overflow-y-auto pb-40 scroll-smooth-touch">
            {creatorError && (
              <div className="fixed top-6 inset-x-0 z-[5000] flex justify-center px-4 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="bg-[#7c2d12] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 max-w-md w-full pointer-events-auto border border-white/20">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {creatorError}
                  </span>
                  <button
                    onClick={() => setCreatorError(null)}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shrink-0"
                  >
                    {strings.common.ok}
                  </button>
                </div>
              </div>
            )}
            {savedDraftPrompt && (
              <div className="fixed inset-0 z-[450] bg-[#2d4239]/40 backdrop-blur-md flex items-center justify-center p-6 text-center animate-in fade-in duration-200">
                <div className="bg-white border border-black/5 p-8 rounded-[3rem] w-full max-w-sm shadow-2xl space-y-6">
                  <div className="w-16 h-16 bg-[#8c6b4f]/10 text-[#8c6b4f] rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-[#0f1a16]">
                      {strings.creator.draftFoundTitle}
                    </h3>
                    <p className="text-[#0f1a16]/60 text-sm mt-2 font-medium">
                      {strings.creator.draftFoundDesc(
                        savedDraftPrompt.questions.length,
                        formatDraftTime(savedDraftPrompt.savedAt),
                      )}
                    </p>
                  </div>
                  <div className="bg-[#f9fbfa] rounded-2xl p-4 text-left border border-black/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#8c6b4f]">
                      {strings.creator.trailNameLabel}
                    </p>
                    <p className="text-sm font-black uppercase tracking-tight text-[#0f1a16] truncate mt-0.5">
                      {savedDraftPrompt.name || strings.creator.untitledTrail}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        clearDraft(initialTrail?.id);
                        setSavedDraftPrompt(null);
                      }}
                      className="flex-1 py-4 bg-[#f9fbfa] hover:bg-[#7c2d12]/10 text-[#7c2d12] rounded-2xl font-bold text-xs uppercase tracking-widest transition-colors"
                    >
                      {strings.creator.startFresh}
                    </button>
                    <button
                      onClick={() => {
                        setQuestions(savedDraftPrompt.questions);
                        if (savedDraftPrompt.name)
                          setTrailName(savedDraftPrompt.name);
                        if (savedDraftPrompt.startingView)
                          setStartingView(savedDraftPrompt.startingView);
                        setLastSaved(savedDraftPrompt.savedAt);
                        setSavedDraftPrompt(null);
                      }}
                      className="flex-1 py-4 bg-[#2d4239] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all"
                    >
                      {strings.creator.resumeDraft}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {showExitConfirm && (
              <div className="fixed inset-0 z-[400] bg-[#2d4239]/40 backdrop-blur-md flex items-center justify-center p-6 text-center animate-in fade-in duration-200">
                <div className="bg-white border border-black/5 p-8 rounded-[3rem] w-full max-w-sm shadow-2xl space-y-6">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-[#0f1a16]">
                      {strings.creator.unsavedChangesTitle}
                    </h3>
                    <p className="text-[#0f1a16]/50 text-sm mt-2 font-medium">
                      {strings.creator.saveDraftPrompt}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        saveDraft({
                          trailId: initialTrail?.id,
                          name: trailName,
                          questions,
                          startingView,
                          savedAt: Date.now(),
                        });
                        setShowExitConfirm(false);
                        onCancel();
                      }}
                      className="w-full py-4 bg-[#2d4239] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-md hover:scale-[1.01] transition-all"
                    >
                      {strings.creator.saveDraft}
                    </button>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowExitConfirm(false)}
                        className="flex-1 py-3.5 bg-[#f9fbfa] hover:bg-black/5 rounded-2xl font-bold text-xs uppercase tracking-widest text-[#0f1a16] transition-colors"
                      >
                        {strings.creator.keepEditing}
                      </button>
                      <button
                        onClick={() => {
                          clearDraft(initialTrail?.id);
                          setShowExitConfirm(false);
                          onCancel();
                        }}
                        className="flex-1 py-3.5 bg-[#7c2d12]/10 hover:bg-[#7c2d12] hover:text-white text-[#7c2d12] rounded-2xl font-bold text-xs uppercase tracking-widest transition-colors"
                      >
                        {strings.common.discard}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {confirmDeleteId && (
              <div className="fixed inset-0 z-[400] bg-[#2d4239]/40 backdrop-blur-md flex items-center justify-center p-6 text-center">
                <div className="bg-white border border-black/5 p-8 rounded-[3rem] w-full max-w-sm shadow-2xl">
                  <h3 className="text-xl font-black mb-2 uppercase tracking-tight">
                    {strings.creator.deleteSpotTitle}
                  </h3>
                  <p className="text-[#0f1a16]/40 text-sm mb-8 font-medium">
                    {strings.creator.deleteSpotDesc}
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex-1 py-4 bg-[#f9fbfa] rounded-2xl font-bold text-xs uppercase tracking-widest"
                    >
                      {strings.common.cancel}
                    </button>
                    <button
                      onClick={handleDeleteSpot}
                      className="flex-1 py-4 bg-[#7c2d12] text-white rounded-2xl font-bold text-xs uppercase tracking-widest"
                    >
                      {strings.common.delete}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <button
                disabled={isProcessing || cameraStatus === "denied"}
                onClick={() => setIsCapturing(true)}
                className={`flex flex-col items-center justify-center space-y-4 bg-white border border-[#2d4239]/5 py-10 rounded-[3rem] transition-all group shadow-sm ${cameraStatus === "denied" ? "opacity-20 grayscale" : ""}`}
              >
                <div className="p-4 bg-[#2d4239]/5 rounded-3xl group-hover:scale-110 transition-transform">
                  <svg
                    className="w-8 h-8 text-[#2d4239]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <span className="font-black text-[10px] uppercase tracking-[0.3em] text-[#2d4239]">
                  {strings.creator.takePhoto}
                </span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center space-y-4 bg-white border border-[#8c6b4f]/5 py-10 rounded-[3rem] transition-all group shadow-sm"
              >
                <div className="p-4 bg-[#8c6b4f]/5 rounded-3xl group-hover:scale-110 transition-transform">
                  <svg
                    className="w-8 h-8 text-[#8c6b4f]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                </div>
                <span className="font-black text-[10px] uppercase tracking-[0.3em] text-[#8c6b4f]">
                  {strings.creator.uploadImage}
                </span>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                />
              </button>
            </div>

            <button
              onClick={() => setIsSettingView(true)}
              className="w-full p-6 bg-white border border-[#2d4239]/10 rounded-[2rem] flex items-center justify-between hover:bg-[#2d4239]/5 transition-all group"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-[#2d4239]/5 rounded-xl flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-[#2d4239]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#2d4239]">
                    {strings.creator.defaultStartingView}
                  </p>
                  <p className="text-[9px] text-[#2d4239]/40 uppercase font-bold">
                    {startingView
                      ? strings.creator.customViewSet
                      : strings.creator.autoCalculatedView}
                  </p>
                </div>
              </div>
              <svg
                className="w-5 h-5 opacity-20 group-hover:opacity-100 transition-opacity"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            <SpotList
              questions={questions}
              onUpdateQuestion={(id, updates) =>
                setQuestions((prev) =>
                  prev.map((q) => (q.id === id ? { ...q, ...updates } : q)),
                )
              }
              onEditLocation={(q) => {
                setPendingQuestion({
                  localDataUrl: q.imageUrl,
                  location: q.location,
                  originalLocation: q.location,
                  editingId: q.id,
                  title: q.title,
                  source: q.locationSource || "MANUAL",
                });
              }}
              onMove={(index, direction) => {
                const newQuestions = [...questions];
                const target = direction === "up" ? index - 1 : index + 1;
                [newQuestions[index], newQuestions[target]] = [
                  newQuestions[target],
                  newQuestions[index],
                ];
                setQuestions(newQuestions);
              }}
              onDelete={setConfirmDeleteId}
            />
          </main>

          <footer className="fixed bottom-0 left-0 right-0 p-8 bg-white/70 backdrop-blur-xl border-t border-[#2d4239]/5 z-40">
            <button
              disabled={questions.length === 0 || isSaving}
              onClick={() => onComplete(questions, trailName, startingView)}
              className={`w-full max-w-4xl mx-auto flex items-center justify-center py-6 btn-sleek !text-xl !tracking-[0.2em] ${questions.length > 0 && !isSaving ? "btn-sleek-pine !bg-[#2d4239]" : "bg-[#f9fbfa] text-[#0f1a16]/10 shadow-none cursor-not-allowed"}`}
            >
              {isSaving ? (
                <div className="flex items-center space-x-4">
                  <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{strings.creator.savingTrail}</span>
                </div>
              ) : (
                strings.creator.saveTrail
              )}
            </button>
          </footer>
        </>
      )}
    </div>
  );
};

export default QuizCreator;
