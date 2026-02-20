import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CompareView from "./components/CompareView";
import CaptureReferenceOverlay from "./components/CaptureReferenceOverlay";
import EvaluateView from "./components/EvaluateView";
import Onboarding from "./components/Onboarding";
import ReferenceView from "./components/ReferenceView";
import SessionList from "./components/SessionList";
import UploadPanel from "./components/UploadPanel";
import { hasSeenOnboarding } from "./components/Onboarding";
import {
  deleteImage,
  deleteSession,
  getImage,
  getSession,
  listSessions,
  saveImage,
  saveSession
} from "./db";
import {
  isSupabaseConfigured,
  pullSessions,
  pushSession,
  supabase
} from "./supabase";
import type { CompareMode, Guides, OverlaySettings, Session } from "./types";
import { createId } from "./utils";
import type { User } from "@supabase/supabase-js";

const MAX_IMAGE_DIM = 1600;
const PREVIEW_MAX_DIM = 96;
const JPEG_QUALITY = 0.85;

function createPreviewDataUrl(bitmap: ImageBitmap): string {
  const w = bitmap.width;
  const h = bitmap.height;
  const scale = PREVIEW_MAX_DIM / Math.max(w, h);
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.65);
}

function resizeImageToBlob(bitmap: ImageBitmap): Promise<{ blob: Blob; width: number; height: number }> {
  const { width: w, height: h } = bitmap;
  const scale = MAX_IMAGE_DIM / Math.max(w, h);
  const width = Math.round(w * scale);
  const height = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("No canvas context"));
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve({ blob, width, height });
        else reject(new Error("Failed to create blob"));
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

const defaultOverlay: OverlaySettings = {
  opacity: 0.7,
  scale: 1,
  rotation: 0,
  translateX: 0,
  translateY: 0
};

const defaultGuides: Guides = {
  grid: false,
  centerline: false
};

type ImageState = {
  id: string;
  url: string;
  previewUrl?: string;
  width: number;
  height: number;
};

type View = "home" | "reference" | "compare" | "evaluate" | "sessions";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [onboardingJustDismissed, setOnboardingJustDismissed] = useState(false);
  const [startCameraAfterOnboarding, setStartCameraAfterOnboarding] = useState(false);
  const [showCameraFromOnboarding, setShowCameraFromOnboarding] = useState(false);
  const [cameraOpenedFromOnboarding, setCameraOpenedFromOnboarding] = useState(false);
  const [triggerCameraWhenHomeVisible, setTriggerCameraWhenHomeVisible] = useState(false);
  const [triggerGalleryWhenHomeVisible, setTriggerGalleryWhenHomeVisible] = useState(false);
  const [reference, setReference] = useState<ImageState | null>(null);
  const [drawing, setDrawing] = useState<ImageState | null>(null);
  const [compareMode, setCompareMode] = useState<CompareMode>("overlay");
  const [overlaySettings, setOverlaySettings] =
    useState<OverlaySettings>(defaultOverlay);
  const [guides, setGuides] = useState<Guides>(defaultGuides);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSessionName, setCurrentSessionName] = useState<string>(
    "Untitled session"
  );
  const [currentSessionCreatedAt, setCurrentSessionCreatedAt] = useState(
    Date.now()
  );
  const [referenceSource, setReferenceSource] = useState<
    "outline" | "shading" | null
  >(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  const referenceInputRef = useRef<HTMLInputElement>(null);
  const referenceCameraInputRef = useRef<HTMLInputElement>(null);
  const drawingInputRef = useRef<HTMLInputElement>(null);

  const refreshSessions = useCallback(async () => {
    const all = await listSessions();
    setSessions(all.sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    }).catch(() => {
      setAuthLoading(false);
    });
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const revokeUrl = (url?: string | null) => {
    if (url) URL.revokeObjectURL(url);
  };

  const clearImages = () => {
    setReference((prev) => {
      revokeUrl(prev?.url);
      return null;
    });
    setDrawing((prev) => {
      revokeUrl(prev?.url);
      return null;
    });
    setReferenceSource(null);
  };

  const processFile = useCallback(
    async (file: File, type: "reference" | "drawing") => {
      const bitmap = await createImageBitmap(file);
      const previewUrl = createPreviewDataUrl(bitmap);
      const id = createId(type);
      const w = bitmap.width;
      const h = bitmap.height;
      const needsResize = Math.max(w, h) > MAX_IMAGE_DIM;
      let blob: Blob;
      let width: number;
      let height: number;
      if (needsResize) {
        const resized = await resizeImageToBlob(bitmap);
        bitmap.close();
        blob = resized.blob;
        width = resized.width;
        height = resized.height;
      } else {
        blob = file;
        width = w;
        height = h;
        bitmap.close();
      }
      const record = {
        id,
        blob,
        width,
        height,
        type
      };
      await saveImage(record);
      return {
        id,
        url: URL.createObjectURL(blob),
        previewUrl,
        width: record.width,
        height: record.height
      } satisfies ImageState;
    },
    []
  );

  const handleReference = useCallback(
    async (file: File, source?: "outline" | "shading") => {
      const image = await processFile(file, "reference");
      setReference((prev) => {
        revokeUrl(prev?.url);
        return image;
      });
      if (source) setReferenceSource(source);
      setView((currentView) => (currentView === "reference" ? "reference" : "reference"));
    },
    [processFile]
  );

  const handleDrawing = useCallback(
    async (file: File) => {
      const image = await processFile(file, "drawing");
      setDrawing((prev) => {
        revokeUrl(prev?.url);
        return image;
      });
      setView("compare");
    },
    [processFile]
  );

  useEffect(() => {
    if (reference && drawing && !currentSessionId) {
      const now = Date.now();
      const id = createId("session");
      setCurrentSessionId(id);
      setCurrentSessionName(`Session ${new Date(now).toLocaleDateString()}`);
      setCurrentSessionCreatedAt(now);
    }
  }, [reference, drawing, currentSessionId]);

  useEffect(() => {
    if (!reference || !drawing || !currentSessionId) return;
    const timeout = window.setTimeout(async () => {
      const session: Session = {
        id: currentSessionId,
        name: currentSessionName,
        createdAt: currentSessionCreatedAt,
        updatedAt: Date.now(),
        referenceImageId: reference.id,
        drawingImageId: drawing.id,
        compareMode,
        overlaySettings,
        guides
      };
      await saveSession(session);
      await refreshSessions();
      if (authUser?.id) {
        const [refRecord, drawRecord] = await Promise.all([
          getImage(reference.id),
          getImage(drawing.id)
        ]);
        if (refRecord && drawRecord) {
          const { error } = await pushSession(
            authUser.id,
            session,
            refRecord.blob,
            drawRecord.blob
          );
          if (error) setSyncError(error.message);
        }
      }
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [
    authUser?.id,
    compareMode,
    currentSessionCreatedAt,
    currentSessionId,
    currentSessionName,
    drawing,
    guides,
    overlaySettings,
    reference,
    refreshSessions
  ]);

  const resetAlignment = () => setOverlaySettings(defaultOverlay);

  const handleCloudSignIn = useCallback(
    async (email: string, password: string) => {
      setSyncError(null);
      if (!supabase) return;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) setSyncError(error.message);
      else if (data.user?.id) {
        const { error: pullErr } = await pullSessions(data.user.id);
        if (pullErr) setSyncError(pullErr.message);
        await refreshSessions();
      }
    },
    [refreshSessions]
  );

  const handleCloudSignUp = useCallback(
    async (email: string, password: string) => {
      setSyncError(null);
      if (!supabase) return;
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setSyncError(error.message);
    },
    []
  );

  const handleCloudSignOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setSyncError(null);
  }, []);

  const handleCloudSync = useCallback(async () => {
    setSyncError(null);
    if (!authUser?.id || !supabase) return;
    const { error } = await pullSessions(authUser.id);
    if (error) setSyncError(error.message);
    else await refreshSessions();
  }, [authUser?.id, refreshSessions]);

  const openSession = useCallback(async (id: string) => {
    const session = await getSession(id);
    if (!session) return;

    const [referenceRecord, drawingRecord] = await Promise.all([
      getImage(session.referenceImageId),
      getImage(session.drawingImageId)
    ]);
    if (!referenceRecord || !drawingRecord) return;

    setReference((prev) => {
      revokeUrl(prev?.url);
      return {
        id: referenceRecord.id,
        url: URL.createObjectURL(referenceRecord.blob),
        width: referenceRecord.width,
        height: referenceRecord.height
      };
    });
    setDrawing((prev) => {
      revokeUrl(prev?.url);
      return {
        id: drawingRecord.id,
        url: URL.createObjectURL(drawingRecord.blob),
        width: drawingRecord.width,
        height: drawingRecord.height
      };
    });

    setCompareMode(session.compareMode);
    setOverlaySettings(session.overlaySettings);
    setGuides(session.guides);
    setCurrentSessionId(session.id);
    setCurrentSessionName(session.name);
    setCurrentSessionCreatedAt(session.createdAt);
    setReferenceSource(null);
    setView("compare");
  }, []);

  const handleDeleteSession = useCallback(async (id: string) => {
    const session = await getSession(id);
    if (session) {
      await deleteSession(id);
      await deleteImage(session.referenceImageId);
      await deleteImage(session.drawingImageId);
      if (id === currentSessionId) {
        setCurrentSessionId(null);
        clearImages();
        setCompareMode("overlay");
        setOverlaySettings(defaultOverlay);
        setGuides(defaultGuides);
        setCurrentSessionName("Untitled session");
        setCurrentSessionCreatedAt(Date.now());
      }
    }
    await refreshSessions();
  }, [currentSessionId, refreshSessions]);

  const handleRenameSession = useCallback(
    async (id: string, name: string) => {
      const session = await getSession(id);
      if (!session) return;
      session.name = name;
      session.updatedAt = Date.now();
      await saveSession(session);
      if (id === currentSessionId) {
        setCurrentSessionName(name);
      }
      await refreshSessions();
      if (authUser?.id) {
        const [refRecord, drawRecord] = await Promise.all([
          getImage(session.referenceImageId),
          getImage(session.drawingImageId)
        ]);
        if (refRecord && drawRecord) {
          const { error } = await pushSession(
            authUser.id,
            session,
            refRecord.blob,
            drawRecord.blob
          );
          if (error) setSyncError(error.message);
        }
      }
    },
    [authUser?.id, currentSessionId, refreshSessions]
  );

  const compareReady = useMemo(() => reference && drawing, [reference, drawing]);

  const hasSeen = hasSeenOnboarding(authUser);
  const showOnboarding = !hasSeen && !onboardingJustDismissed;
  const showOnboardingScreen = showOnboarding || cameraOpenedFromOnboarding;

  const handleOnboardingFinish = useCallback(() => {
    setCameraOpenedFromOnboarding(false);
    setOnboardingJustDismissed(true);
    setView("home");
  }, []);

  const handleOnboardingFinishAndStartCamera = useCallback(() => {
    setCameraOpenedFromOnboarding(false);
    setView("home");
    setStartCameraAfterOnboarding(true);
  }, []);

  const handleOnboardingTakePhotoRequest = useCallback(() => {
    setCameraOpenedFromOnboarding(true);
    setShowCameraFromOnboarding(true);
  }, []);

  const handleCameraFromOnboardingClose = useCallback(() => {
    setShowCameraFromOnboarding(false);
  }, []);

  const handleCameraFromOnboardingReference = useCallback(
    (file: File, source?: "outline" | "shading") => {
      handleReference(file, source);
      setCameraOpenedFromOnboarding(false);
      setShowCameraFromOnboarding(false);
      setOnboardingJustDismissed(true);
      setView("home");
    },
    [handleReference]
  );

  const handleOnboardingUploadGalleryRequest = useCallback(() => {
    setCameraOpenedFromOnboarding(false);
    setOnboardingJustDismissed(true);
    setView("home");
    setTriggerGalleryWhenHomeVisible(true);
  }, []);

  useEffect(() => {
    if (!startCameraAfterOnboarding || view !== "home") return;
    let retryId: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(() => {
      if (referenceCameraInputRef.current) {
        referenceCameraInputRef.current.click();
        setStartCameraAfterOnboarding(false);
        return;
      }
      retryId = setTimeout(() => {
        referenceCameraInputRef.current?.click();
        setStartCameraAfterOnboarding(false);
      }, 50);
    }, 0);
    return () => {
      clearTimeout(t);
      if (retryId !== undefined) clearTimeout(retryId);
    };
  }, [startCameraAfterOnboarding, view]);

  const handleOnboardingLogIn = useCallback(() => {
    setCameraOpenedFromOnboarding(false);
    setView("sessions");
  }, []);

  return (
    <div className="app">
      <div className="device-shell">
        <div className="device-notch" />
        <div className="device-screen">
          {showCameraFromOnboarding && (
            <CaptureReferenceOverlay
              open={showCameraFromOnboarding}
              onClose={handleCameraFromOnboardingClose}
              onReferenceSelected={handleCameraFromOnboardingReference}
            />
          )}
          {showOnboardingScreen ? (
            <Onboarding
              onFinish={handleOnboardingFinish}
              onLogIn={handleOnboardingLogIn}
              onFinishAndStartCamera={handleOnboardingFinishAndStartCamera}
              onTakePhotoRequest={handleOnboardingTakePhotoRequest}
              onUploadFromGalleryRequest={handleOnboardingUploadGalleryRequest}
              authUserId={authUser?.id ?? null}
            />
          ) : (
            <div className="device-screen-main" style={{ display: "flex", flexDirection: "column" }}>
          {view === "home" && (
            <UploadPanel
              referenceUrl={reference?.url}
              referencePreviewUrl={reference?.previewUrl}
              drawingUrl={drawing?.url}
              drawingPreviewUrl={drawing?.previewUrl}
              onReferenceSelected={handleReference}
              onDrawingSelected={handleDrawing}
              onOpenSessions={() => setView("sessions")}
              triggerCameraOnMount={triggerCameraWhenHomeVisible}
              triggerGalleryOnMount={triggerGalleryWhenHomeVisible}
              onTriggerCameraDone={() => setTriggerCameraWhenHomeVisible(false)}
              onTriggerGalleryDone={() => setTriggerGalleryWhenHomeVisible(false)}
            />
          )}

          {view === "reference" && reference && (
            <ReferenceView
              referenceUrl={reference.url}
              referencePreviewUrl={reference.previewUrl ?? null}
              onBack={() => setView("home")}
              onScanSketch={() => referenceCameraInputRef.current?.click()}
              onUploadFromGallery={() => referenceInputRef.current?.click()}
            />
          )}

          {view === "compare" && (
            <CompareView
              referenceUrl={reference?.url}
              referencePreviewUrl={reference?.previewUrl}
              drawingUrl={drawing?.url}
              drawingPreviewUrl={drawing?.previewUrl}
              compareMode={compareMode}
              overlaySettings={overlaySettings}
              guides={guides}
              onChangeMode={setCompareMode}
              onChangeOverlay={setOverlaySettings}
              onChangeGuides={setGuides}
              onResetAlignment={resetAlignment}
              onBack={() => setView("home")}
              onOpenSessions={() => setView("sessions")}
              onAddReference={() => referenceInputRef.current?.click()}
              onAddDrawing={() => drawingInputRef.current?.click()}
              onEvaluate={() => setView("evaluate")}
            />
          )}

          {view === "evaluate" && (
            <EvaluateView
              referenceUrl={reference?.url ?? null}
              referencePreviewUrl={reference?.previewUrl ?? null}
              drawingUrl={drawing?.url ?? null}
              drawingPreviewUrl={drawing?.previewUrl ?? null}
              overlaySettings={overlaySettings}
              referenceIsOutline={referenceSource === "outline"}
              onBack={() => setView("compare")}
              onSaveToGallery={() => setView("sessions")}
            />
          )}

          {view === "sessions" && (
            <SessionList
              sessions={sessions}
              onOpen={openSession}
              onDelete={handleDeleteSession}
              onRename={handleRenameSession}
              onBack={() =>
                setView(
                  compareReady ? "compare" : reference ? "reference" : "home"
                )
              }
              cloudEnabled={isSupabaseConfigured()}
              authUser={authUser}
              authLoading={authLoading}
              syncError={syncError}
              onCloudSignIn={handleCloudSignIn}
              onCloudSignUp={handleCloudSignUp}
              onCloudSignOut={handleCloudSignOut}
              onCloudSync={handleCloudSync}
            />
          )}

            </div>
          )}

          <input
            ref={referenceInputRef}
            className="file-input"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleReference(file);
            }}
          />
          <input
            ref={referenceCameraInputRef}
            className="file-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleReference(file);
            }}
          />
          <input
            ref={drawingInputRef}
            className="file-input"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleDrawing(file);
            }}
          />
        </div>
      </div>
    </div>
  );
}
