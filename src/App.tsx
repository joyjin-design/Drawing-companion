import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CompareView from "./components/CompareView";
import EvaluateView from "./components/EvaluateView";
import SessionList from "./components/SessionList";
import UploadPanel from "./components/UploadPanel";
import {
  deleteImage,
  deleteSession,
  getImage,
  getSession,
  listSessions,
  saveImage,
  saveSession
} from "./db";
import type { CompareMode, Guides, OverlaySettings, Session } from "./types";
import { createId } from "./utils";

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
  width: number;
  height: number;
};

type View = "home" | "compare" | "evaluate" | "sessions";

export default function App() {
  const [view, setView] = useState<View>("home");
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

  const referenceInputRef = useRef<HTMLInputElement>(null);
  const drawingInputRef = useRef<HTMLInputElement>(null);

  const refreshSessions = useCallback(async () => {
    const all = await listSessions();
    setSessions(all.sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

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
  };

  const processFile = useCallback(
    async (file: File, type: "reference" | "drawing") => {
      const bitmap = await createImageBitmap(file);
      const id = createId(type);
      const record = {
        id,
        blob: file,
        width: bitmap.width,
        height: bitmap.height,
        type
      };
      bitmap.close();
      await saveImage(record);
      return {
        id,
        url: URL.createObjectURL(file),
        width: record.width,
        height: record.height
      } satisfies ImageState;
    },
    []
  );

  const handleReference = useCallback(
    async (file: File) => {
      const image = await processFile(file, "reference");
      setReference((prev) => {
        revokeUrl(prev?.url);
        return image;
      });
      setView("compare");
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
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [
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
    },
    [currentSessionId, refreshSessions]
  );

  const compareReady = useMemo(() => reference && drawing, [reference, drawing]);

  return (
    <div className="app">
      <div className="device-shell">
        <div className="device-notch" />
        <div className="device-screen">
          {view === "home" && (
            <UploadPanel
              referenceUrl={reference?.url}
              drawingUrl={drawing?.url}
              onReferenceSelected={handleReference}
              onDrawingSelected={handleDrawing}
              onOpenSessions={() => setView("sessions")}
            />
          )}

          {view === "compare" && (
            <CompareView
              referenceUrl={reference?.url}
              drawingUrl={drawing?.url}
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
              drawingUrl={drawing?.url ?? null}
              overlaySettings={overlaySettings}
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
              onBack={() => setView(compareReady ? "compare" : "home")}
            />
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
