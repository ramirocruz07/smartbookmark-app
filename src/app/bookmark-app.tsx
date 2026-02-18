"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type Bookmark = {
  id: string;
  url: string;
  title: string;
  created_at: string;
};

export default function BookmarkApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );

  const sortedBookmarks = useMemo(
    () =>
      [...bookmarks].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [bookmarks],
  );

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        await loadBookmarks();
        setupRealtime();
      }
    };

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (!newSession?.user) {
        setBookmarks([]);
        teardownRealtime();
      } else {
        loadBookmarks();
        setupRealtime();
      }
    });

    init();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      teardownRealtime();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBookmarks = async () => {
    setError(null);
    const { data, error } = await supabase
      .from("bookmarks")
      .select("id, url, title, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setError("Failed to load bookmarks");
      return;
    }

    setBookmarks(data ?? []);
  };

  const teardownRealtime = () => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
  };

  const setupRealtime = () => {
    teardownRealtime();

    const channel = supabase
      .channel("bookmarks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookmarks" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setBookmarks((current) => [
              ...(current ?? []),
              payload.new as Bookmark,
            ]);
          } else if (payload.eventType === "DELETE") {
            setBookmarks((current) =>
              (current ?? []).filter((b) => b.id !== (payload.old as any).id),
            );
          } else if (payload.eventType === "UPDATE") {
            setBookmarks((current) =>
              (current ?? []).map((b) =>
                b.id === (payload.new as any).id
                  ? (payload.new as Bookmark)
                  : b,
              ),
            );
          }
        },
      )
      .subscribe();

    realtimeChannelRef.current = channel;
  };

  const handleSignIn = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Force Google to show the account chooser instead of silently reusing
        // the previous Google session in the browser.
        queryParams: {
          prompt: "select_account",
        },
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/`
            : undefined,
      },
    });

    if (error) {
      console.error(error);
      setError("Failed to sign in with Google");
    }
  };

  const handleSignOut = async () => {
    setError(null);
    teardownRealtime();
    await supabase.auth.signOut();
  };

  const handleAddBookmark = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!url.trim() || !title.trim()) {
      setError("Please provide both a title and URL");
      return;
    }

    setSaving(true);
    setError(null);

    const normalizedUrl = url.startsWith("http://") || url.startsWith("https://")
      ? url
      : `https://${url}`;

    const { error } = await supabase.from("bookmarks").insert({
      title: title.trim(),
      url: normalizedUrl.trim(),
      user_id: user.id,
    });

    setSaving(false);

    if (error) {
      console.error(error);
      setError("Failed to save bookmark");
      return;
    }

    setTitle("");
    setUrl("");
  };

  const handleDeleteBookmark = async (id: string) => {
    setError(null);
    const { error } = await supabase.from("bookmarks").delete().eq("id", id);
    if (error) {
      console.error(error);
      setError("Failed to delete bookmark");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white">
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/40 backdrop-blur-xl px-6 py-4 text-sm text-slate-200 shadow-lg shadow-cyan-500/10">
          Connecting to Smart Bookmark...
        </div>
      </div>
    );
  }

  if (!session || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-slate-900/40 backdrop-blur-xl p-8 shadow-2xl shadow-cyan-500/10">
          <div className="mb-6 space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              Smart Bookmark
            </p>
            <h1 className="text-2xl font-semibold text-white">
              Sign in to your smart bookmarks
            </h1>
            <p className="text-sm text-slate-400">
              Use your Google account to save private bookmarks that sync in
              real time across tabs.
            </p>
          </div>
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={handleSignIn}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white shadow-sm">
              <span className="text-xs">G</span>
            </span>
            <span>Continue with Google</span>
          </button>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            We only use your Google identity for login. Your bookmarks are
            private to your account and never visible to other users.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 text-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-cyan-500/30 bg-slate-900/40 backdrop-blur-xl px-6 py-5 shadow-xl shadow-cyan-500/10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              SMART BOOKMARK
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              Your realtime bookmark inbox
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Signed in as{" "}
              <span className="font-medium text-white">
                {user.email}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center rounded-lg border border-cyan-500/30 bg-slate-900/40 backdrop-blur-xl px-4 py-2 text-xs font-medium text-white shadow-sm shadow-cyan-500/10 transition hover:bg-slate-800/60 hover:border-cyan-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            Sign out
          </button>
        </header>

        <main className="flex flex-col gap-6">
          <section className="rounded-2xl border border-cyan-500/30 bg-slate-900/40 backdrop-blur-xl p-6 shadow-xl shadow-cyan-500/10">
            <form
              onSubmit={handleAddBookmark}
              className="flex flex-col gap-4 sm:flex-row sm:items-end"
            >
              <div className="flex-1 space-y-2 min-w-0">
                <label className="block text-xs font-medium text-white">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What is this link?"
                  className="w-full rounded-lg border border-cyan-500/30 bg-slate-900/80 backdrop-blur-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 shadow-inner outline-none ring-0 transition focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <label className="block text-xs font-medium text-white">
                  URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full rounded-lg border border-cyan-500/30 bg-slate-900/80 backdrop-blur-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 shadow-inner outline-none ring-0 transition focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-cyan-500/30 bg-slate-900/40 backdrop-blur-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-cyan-500/10 transition hover:bg-slate-800/60 hover:border-cyan-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {saving ? "Saving..." : "Add bookmark"}
                </button>
              </div>
            </form>
            {error && (
              <p className="mt-3 text-xs text-red-300">
                {error}
              </p>
            )}
            <p className="mt-4 text-[11px] text-slate-400">
              Bookmarks are private to your account. Open this app in another
              tab while logged in to see new items appear in real time.
            </p>
          </section>

          <section className="rounded-2xl border border-cyan-500/30 bg-slate-900/40 backdrop-blur-xl p-6 shadow-xl shadow-cyan-500/10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Your bookmarks
              </h2>
              <span className="text-[11px] text-white">
                {sortedBookmarks.length} saved
              </span>
            </div>
            {sortedBookmarks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-cyan-500/20 bg-slate-900/40 backdrop-blur-xl px-4 py-6 text-xs text-slate-400">
                No bookmarks yet. Add your first link above to get started.
              </p>
            ) : (
              <ul className="divide-y divide-cyan-500/10 text-sm">
                {sortedBookmarks.map((bookmark) => (
                  <li
                    key={bookmark.id}
                    className="flex items-start gap-4 py-4 min-w-0"
                  >
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="font-medium text-white break-words">
                        {bookmark.title}
                      </p>
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs text-cyan-300 hover:text-cyan-200 break-all"
                      >
                        {bookmark.url}
                      </a>
                      <p className="text-[11px] text-slate-400">
                        Saved{" "}
                        {new Date(bookmark.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteBookmark(bookmark.id)}
                      className="flex-shrink-0 inline-flex items-center justify-center rounded-lg border border-cyan-500/30 bg-slate-900/40 backdrop-blur-xl px-3 py-1.5 text-[11px] font-medium text-white shadow-sm shadow-cyan-500/10 transition hover:bg-red-500/20 hover:text-red-200 hover:border-red-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}


