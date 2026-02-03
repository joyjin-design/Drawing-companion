import { useState } from "react";
import type { Session } from "../types";
import { formatDate } from "../utils";

export type SessionListProps = {
  sessions: Session[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onBack: () => void;
};

export default function SessionList({
  sessions,
  onOpen,
  onDelete,
  onRename,
  onBack
}: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  return (
    <div className="screen session-screen">
      <header className="top-bar">
        <button className="icon-button" onClick={onBack}>
          ←
        </button>
        <h2>Saved sessions</h2>
        <span className="icon-button ghost">·</span>
      </header>

      <div className="session-list">
        {sessions.length === 0 && (
          <p className="empty-copy">No saved sessions yet.</p>
        )}
        {sessions.map((session) => (
          <div className="session-card" key={session.id}>
            <div className="session-info">
              {editingId === session.id ? (
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={() => {
                    if (draftName.trim()) {
                      onRename(session.id, draftName.trim());
                    }
                    setEditingId(null);
                  }}
                />
              ) : (
                <button
                  className="session-name"
                  onClick={() => onOpen(session.id)}
                >
                  {session.name}
                </button>
              )}
              <span className="session-date">
                Updated {formatDate(session.updatedAt)}
              </span>
            </div>
            <div className="session-actions">
              <button
                className="mini-button"
                onClick={() => {
                  setEditingId(session.id);
                  setDraftName(session.name);
                }}
              >
                Rename
              </button>
              <button
                className="mini-button danger"
                onClick={() => onDelete(session.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
