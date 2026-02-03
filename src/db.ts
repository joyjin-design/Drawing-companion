import { openDB, DBSchema } from "idb";
import type { ImageRecord, Session } from "./types";

interface DrawingDB extends DBSchema {
  images: {
    key: string;
    value: ImageRecord;
  };
  sessions: {
    key: string;
    value: Session;
    indexes: { "by-updated": number };
  };
}

const DB_NAME = "drawing-companion";
const DB_VERSION = 1;

const dbPromise = openDB<DrawingDB>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    const imageStore = db.createObjectStore("images", { keyPath: "id" });
    imageStore.createIndex("by-type", "type");

    const sessionStore = db.createObjectStore("sessions", { keyPath: "id" });
    sessionStore.createIndex("by-updated", "updatedAt");
  }
});

export async function saveImage(record: ImageRecord) {
  const db = await dbPromise;
  await db.put("images", record);
}

export async function getImage(id: string) {
  const db = await dbPromise;
  return db.get("images", id);
}

export async function deleteImage(id: string) {
  const db = await dbPromise;
  await db.delete("images", id);
}

export async function saveSession(session: Session) {
  const db = await dbPromise;
  await db.put("sessions", session);
}

export async function listSessions() {
  const db = await dbPromise;
  return db.getAllFromIndex("sessions", "by-updated");
}

export async function getSession(id: string) {
  const db = await dbPromise;
  return db.get("sessions", id);
}

export async function deleteSession(id: string) {
  const db = await dbPromise;
  await db.delete("sessions", id);
}
