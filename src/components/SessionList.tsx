import { useState } from "react";
import type { Session } from "../types";
import { formatDate } from "../utils";
import type { User } from "@supabase/supabase-js";

export type SessionListProps = {
  sessions: Session[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onBack: () => void;
  cloudEnabled?: boolean;
  authUser?: User | null;
  authLoading?: boolean;
  syncError?: string | null;
  onCloudSignIn?: (email: string, password: string) => void;
  onCloudSignUp?: (email: string, password: string) => void;
  onCloudSignOut?: () => void;
  onCloudSync?: () => void;
};

export default function SessionList({
  sessions,
  onOpen,
  onDelete,
  onRename,
  onBack,
  cloudEnabled = false,
  authUser = null,
  authLoading = false,
  syncError = null,
  onCloudSignIn,
  onCloudSignUp,
  onCloudSignOut,
  onCloudSync
}: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setCloudBusy(true);
    try {
      if (authMode === "signin" && onCloudSignIn) {
        await onCloudSignIn(email.trim(), password);
      } else if (authMode === "signup" && onCloudSignUp) {
        await onCloudSignUp(email.trim(), password);
      }
    } finally {
      setCloudBusy(false);
    }
  };

  const handleSync = async () => {
    if (!onCloudSync) return;
    setCloudBusy(true);
    try {
      await onCloudSync();
    } finally {
      setCloudBusy(false);
    }
  };

  return (
    <div className="screen session-screen">
      <header className="top-bar">
        <button className="icon-button" onClick={onBack}>
          ←
        </button>
        <h2>Saved sessions</h2>
        <span className="icon-button ghost">·</span>
      </header>

      {cloudEnabled && (
        <section className="cloud-section">
          {authLoading ? (
            <p className="cloud-status">Loading…</p>
          ) : authUser ? (
            <div className="cloud-signed-in">
              <p className="cloud-status">
                Backed up as <strong>{authUser.email ?? "Signed in"}</strong>
              </p>
              <div className="cloud-actions">
                <button
                  type="button"
                  className="mini-button"
                  onClick={handleSync}
                  disabled={cloudBusy}
                >
                  {cloudBusy ? "Syncing…" : "Sync now"}
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={onCloudSignOut}
                  disabled={cloudBusy}
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="cloud-sign-in">
              <p className="cloud-status">Sign in to back up sessions to the cloud.</p>
              <form onSubmit={handleAuthSubmit} className="cloud-form">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="cloud-input"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                  className="cloud-input"
                />
                <div className="cloud-form-actions">
                  <button
                    type="submit"
                    className="mini-button primary"
                    disabled={cloudBusy || !email.trim() || !password}
                  >
                    {cloudBusy ? "…" : authMode === "signin" ? "Sign in" : "Sign up"}
                  </button>
                  <button
                    type="button"
                    className="mini-button ghost"
                    onClick={() => setAuthMode((m) => (m === "signin" ? "signup" : "signin"))}
                  >
                    {authMode === "signin" ? "Sign up" : "Sign in"}
                  </button>
                </div>
              </form>
            </div>
          )}
          {syncError && (
            <p className="cloud-error" role="alert">
              {syncError}
            </p>
          )}
        </section>
      )}

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
