import { createClient } from "@supabase/supabase-js";
import type { Session as AppSession } from "./types";
import { saveImage, saveSession } from "./db";
import type { ImageRecord } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  url && anonKey ? createClient(url, anonKey) : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

const BUCKET = "images";

/** Session row shape in Supabase (snake_case for DB) */
export type RemoteSessionRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: number;
  updated_at: number;
  reference_image_id: string;
  drawing_image_id: string;
  compare_mode: string;
  overlay_settings: Record<string, unknown>;
  guides: Record<string, unknown>;
};

function toRemoteRow(s: AppSession, userId: string): RemoteSessionRow {
  return {
    id: s.id,
    user_id: userId,
    name: s.name,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    reference_image_id: s.referenceImageId,
    drawing_image_id: s.drawingImageId,
    compare_mode: s.compareMode,
    overlay_settings: s.overlaySettings as Record<string, unknown>,
    guides: s.guides as Record<string, unknown>
  };
}

function fromRemoteRow(r: RemoteSessionRow): AppSession {
  return {
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    referenceImageId: r.reference_image_id,
    drawingImageId: r.drawing_image_id,
    compareMode: r.compare_mode as AppSession["compareMode"],
    overlaySettings: r.overlay_settings as AppSession["overlaySettings"],
    guides: r.guides as AppSession["guides"]
  };
}

function storagePath(userId: string, imageId: string): string {
  return `${userId}/${imageId}.jpg`;
}

/** Upload a session and its two images to Supabase. Call when signed in and saving. */
export async function pushSession(
  userId: string,
  session: AppSession,
  referenceBlob: Blob,
  drawingBlob: Blob
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error("Supabase not configured") };

  try {
    const refErr = (await supabase.storage.from(BUCKET).upload(
      storagePath(userId, session.referenceImageId),
      referenceBlob,
      { contentType: "image/jpeg", upsert: true }
    )).error;
    if (refErr) return { error: new Error(refErr.message) };

    const drawErr = (await supabase.storage.from(BUCKET).upload(
      storagePath(userId, session.drawingImageId),
      drawingBlob,
      { contentType: "image/jpeg", upsert: true }
    )).error;
    if (drawErr) return { error: new Error(drawErr.message) };

    const row = toRemoteRow(session, userId);
    const { error } = await supabase.from("sessions").upsert(row, {
      onConflict: "id"
    });
    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e : new Error(String(e))
    };
  }
}

/** Download all sessions and their images from Supabase and merge into IndexedDB. */
export async function pullSessions(userId: string): Promise<{
  error: Error | null;
  sessionIds: string[];
}> {
  if (!supabase) return { error: new Error("Supabase not configured"), sessionIds: [] };

  try {
    const { data: rows, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) return { error: new Error(error.message), sessionIds: [] };
    if (!rows || rows.length === 0) return { error: null, sessionIds: [] };

    const sessionIds: string[] = [];
    const imageIdToType = new Map<string, "reference" | "drawing">();

    for (const r of rows as RemoteSessionRow[]) {
      sessionIds.push(r.id);
      imageIdToType.set(r.reference_image_id, "reference");
      imageIdToType.set(r.drawing_image_id, "drawing");
    }

    for (const [imageId, type] of imageIdToType) {
      const { data: blob, error: downloadErr } = await supabase.storage
        .from(BUCKET)
        .download(storagePath(userId, imageId));

      if (downloadErr || !blob) continue;

      const record: ImageRecord = {
        id: imageId,
        blob,
        width: 0,
        height: 0,
        type
      };
      const img = await createImageBitmap(blob);
      record.width = img.width;
      record.height = img.height;
      img.close();
      await saveImage(record);
    }

    for (const r of rows as RemoteSessionRow[]) {
      const session = fromRemoteRow(r);
      await saveSession(session);
    }

    return { error: null, sessionIds };
  } catch (e) {
    return {
      error: e instanceof Error ? e : new Error(String(e)),
      sessionIds: []
    };
  }
}
