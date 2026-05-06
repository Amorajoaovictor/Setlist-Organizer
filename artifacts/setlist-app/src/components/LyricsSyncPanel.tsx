"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Pause,
  Play,
  Save,
  Search,
  Timer,
  Upload,
} from "lucide-react";
import type { SetlistSong } from "@workspace/api-client-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type LyricLine = {
  index: number;
  text: string;
  startMs: number | null;
};

type StoredLyrics = {
  id: number;
  songId: number;
  source: "lrclib" | "manual";
  lrclibId: number | null;
  plainLyrics: string;
  syncedLyrics: string | null;
  lines: LyricLine[];
  bpm: number | null;
};

type LrclibLyricsResult = {
  id: number;
  plainLyrics: string;
  syncedLyrics: string | null;
  lines: LyricLine[];
};

type Draft = {
  source: "lrclib" | "manual";
  lrclibId: number | null;
  plainLyrics: string;
  lines: LyricLine[];
  audioUrl: string;
  bpm: number;
};

const emptyDraft: Draft = {
  source: "manual",
  lrclibId: null,
  plainLyrics: "",
  lines: [],
  audioUrl: "",
  bpm: 120,
};

export function LyricsSyncPanel({
  setlistId,
  song,
}: {
  setlistId: number;
  song: SetlistSong | null;
}) {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const metronomeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [selectedLine, setSelectedLine] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [countIn, setCountIn] = useState<number | null>(null);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [localAudioUrl, setLocalAudioUrl] = useState("");

  const storageKey = song
    ? `setlist:${setlistId}:song:${song.id}:lyrics-draft`
    : null;

  const currentLine = draft.lines[selectedLine] ?? null;
  const syncedCount = draft.lines.filter((line) => line.startMs != null).length;
  const previewAudioSrc = localAudioUrl || draft.audioUrl;

  const syncedLyricsText = useMemo(() => formatSyncedLyrics(draft.lines), [draft.lines]);

  useEffect(() => {
    stopMetronome();
    setPresentationOpen(false);
    setSelectedLine(0);
    setElapsedMs(0);
    setLocalAudioUrl("");

    if (!song || !storageKey) {
      setDraft(emptyDraft);
      return;
    }

    const activeSong = song;
    const draftKey = storageKey;
    let cancelled = false;

    async function loadLyrics() {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/setlists/${setlistId}/songs/${activeSong.id}/lyrics`,
        );

        if (response.ok) {
          const payload = (await response.json()) as StoredLyrics;
          const localAudioUrl = readLocalDraft(draftKey)?.audioUrl ?? "";
          if (!cancelled) {
            setDraft({
              source: payload.source,
              lrclibId: payload.lrclibId,
              plainLyrics: payload.plainLyrics,
              lines: payload.lines,
              audioUrl: localAudioUrl,
              bpm: payload.bpm ?? 120,
            });
          }
          return;
        }

        const localDraft = readLocalDraft(draftKey);
        if (localDraft && !cancelled) {
          setDraft({ ...emptyDraft, ...localDraft });
          return;
        }

        if (!cancelled) {
          setDraft(emptyDraft);
        }
      } catch {
        if (!cancelled) {
          setDraft(emptyDraft);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadLyrics();

    return () => {
      cancelled = true;
    };
  }, [setlistId, song, storageKey]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, storageKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      const nextElapsedMs = Math.round(audio.currentTime * 1_000);
      setElapsedMs(nextElapsedMs);

      if (!audio.paused) {
        const activeIndex = findActiveLineIndex(draft.lines, nextElapsedMs);
        if (activeIndex >= 0) {
          setSelectedLine(activeIndex);
        }
      }
    }, 200);

    return () => window.clearInterval(interval);
  }, [draft.lines]);

  useEffect(() => {
    return () => stopMetronome();
  }, []);

  useEffect(() => {
    return () => {
      if (localAudioUrl) {
        URL.revokeObjectURL(localAudioUrl);
      }
    };
  }, [localAudioUrl]);

  function applyPlainLyrics() {
    const lines = normalizePlainLyrics(draft.plainLyrics).map((text, index) => ({
      index,
      text,
      startMs: draft.lines[index]?.startMs ?? null,
    }));

    setDraft((current) => ({ ...current, source: "manual", lines }));
    setSelectedLine(0);
  }

  async function searchLrclib() {
    if (!song) {
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/setlists/${setlistId}/songs/${song.id}/lyrics/search`,
        { method: "POST" },
      );

      if (!response.ok) {
        throw new Error("LRCLIB did not return lyrics");
      }

      const payload = (await response.json()) as LrclibLyricsResult;
      setDraft((current) => ({
        ...current,
        source: "lrclib",
        lrclibId: payload.id || null,
        plainLyrics: payload.plainLyrics,
        lines: payload.lines,
      }));
      setSelectedLine(0);
      toast({ title: "Lyrics loaded from LRCLIB" });
    } catch {
      toast({
        title: "LRCLIB search failed",
        description: "Paste plain lyrics and use manual sync for this song.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  }

  function markCurrentTimestamp() {
    const audio = audioRef.current;
    const timestampMs = audio ? Math.round(audio.currentTime * 1_000) : elapsedMs;

    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line, index) =>
        index === selectedLine ? { ...line, startMs: timestampMs } : line,
      ),
    }));
    setSelectedLine((current) => Math.min(current + 1, draft.lines.length - 1));
  }

  function moveLine(direction: -1 | 1) {
    setSelectedLine((current) =>
      Math.min(Math.max(current + direction, 0), Math.max(draft.lines.length - 1, 0)),
    );
  }

  function selectLocalAudio(file: File | undefined) {
    if (!file) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLocalAudioUrl(objectUrl);
    setDraft((current) => ({ ...current, audioUrl: "" }));
  }

  async function saveLyrics() {
    if (!song) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/setlists/${setlistId}/songs/${song.id}/lyrics`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: draft.source,
            lrclibId: draft.lrclibId,
            plainLyrics: draft.plainLyrics,
            syncedLyrics: syncedLyricsText || null,
            lines: draft.lines,
            bpm: draft.bpm,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Save failed");
      }

      const payload = (await response.json()) as StoredLyrics;
      setDraft((current) => ({
        ...current,
        source: payload.source,
        lrclibId: payload.lrclibId,
        plainLyrics: payload.plainLyrics,
        lines: payload.lines,
        bpm: payload.bpm ?? current.bpm,
      }));
      toast({ title: "Lyrics saved" });
    } catch {
      toast({
        title: "Could not save lyrics",
        description: "Check the API/database connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function startMetronome() {
    if (metronomeOn) {
      stopMetronome();
      return;
    }

    const beatMs = 60_000 / draft.bpm;
    let beat = 0;
    setMetronomeOn(true);

    const tick = () => {
      beat += 1;
      playClick(beat <= 4);
      setCountIn(beat <= 4 ? beat : null);
    };

    tick();
    metronomeRef.current = setInterval(tick, beatMs);
  }

  function stopMetronome() {
    if (metronomeRef.current) {
      clearInterval(metronomeRef.current);
      metronomeRef.current = null;
    }
    setMetronomeOn(false);
    setCountIn(null);
  }

  function playClick(accent: boolean) {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioContextRef.current ??= new AudioContextClass();
    const context = audioContextRef.current;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.frequency.value = accent ? 1_200 : 800;
    gain.gain.value = accent ? 0.2 : 0.12;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.04);
  }

  if (!song) {
    return (
      <section className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <FileText className="h-5 w-5" />
          Add a track to configure synced lyrics.
        </div>
      </section>
    );
  }

  return (
    <section className="glass-panel rounded-2xl p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-display font-bold">Synced lyrics</h2>
          <p className="text-sm text-muted-foreground">
            {song.title} - {song.artist}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={searchLrclib} disabled={isSearching}>
            {isSearching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            LRCLIB
          </Button>
          <Button size="sm" variant="glow" onClick={saveLyrics} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading lyrics
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-muted-foreground">
                Plain lyrics
              </span>
              <textarea
                value={draft.plainLyrics}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    source: "manual",
                    plainLyrics: event.target.value,
                  }))
                }
                className="min-h-44 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm outline-none ring-primary/40 transition focus:ring-2"
                placeholder="Paste lyrics here, one line per phrase."
              />
            </label>
            <Button variant="outline" onClick={applyPlainLyrics} className="w-full">
              Split into controllable lines
            </Button>

            <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Timer className="h-4 w-4 text-primary" />
                Preview audio and metronome
              </div>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Upload className="h-3.5 w-3.5" />
                  Local audio file
                </span>
                <Input
                  type="file"
                  accept="audio/*"
                  onChange={(event) => selectLocalAudio(event.target.files?.[0])}
                />
              </label>
              <Input
                value={draft.audioUrl}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, audioUrl: event.target.value }))
                }
                placeholder="Temporary audio URL for client-side preview"
              />
              {previewAudioSrc ? (
                <audio
                  ref={audioRef}
                  src={previewAudioSrc}
                  controls
                  className="w-full"
                />
              ) : (
                <audio ref={audioRef} className="hidden" />
              )}
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Input
                  type="number"
                  min={30}
                  max={300}
                  value={draft.bpm}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      bpm: Number.parseInt(event.target.value, 10) || 120,
                    }))
                  }
                />
                <Button variant={metronomeOn ? "secondary" : "outline"} onClick={startMetronome}>
                  {metronomeOn ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                  {metronomeOn ? "Stop" : "Click"}
                </Button>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Counter {formatMs(elapsedMs)}</span>
                <span>{countIn ? `Count-in ${countIn}` : `${syncedCount}/${draft.lines.length} synced`}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Current line
                  </p>
                  <p className="font-semibold">{currentLine?.text ?? "No line selected"}</p>
                </div>
                <div className="font-mono text-lg text-primary">
                  {currentLine?.startMs == null ? "--:--.--" : formatMs(currentLine.startMs)}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" onClick={() => moveLine(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="glow" onClick={markCurrentTimestamp} disabled={draft.lines.length === 0}>
                  Mark
                </Button>
                <Button variant="outline" onClick={() => moveLine(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => setPresentationOpen(true)}
                disabled={draft.lines.length === 0}
              >
                Presentation preview
              </Button>
            </div>

            <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {draft.lines.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">
                  Search LRCLIB or split pasted lyrics to create sync lines.
                </div>
              ) : (
                draft.lines.map((line, index) => (
                  <button
                    key={`${line.index}-${index}`}
                    type="button"
                    onClick={() => setSelectedLine(index)}
                    className={cn(
                      "grid w-full grid-cols-[4.5rem_1fr] gap-3 rounded-xl border p-3 text-left text-sm transition",
                      selectedLine === index
                        ? "border-primary/70 bg-primary/10 text-foreground"
                        : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20",
                    )}
                  >
                    <span className="font-mono text-xs">
                      {line.startMs == null ? "--:--.--" : formatMs(line.startMs)}
                    </span>
                    <span>{line.text}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {presentationOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/50">{song.title}</p>
              <p className="text-lg font-semibold">{formatMs(elapsedMs)}</p>
            </div>
            <Button variant="outline" onClick={() => setPresentationOpen(false)}>
              Close
            </Button>
          </div>
          <div className="flex flex-1 items-center justify-center text-center">
            <p className="max-w-5xl text-4xl font-bold leading-tight sm:text-6xl">
              {currentLine?.text ?? ""}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Button variant="outline" onClick={() => moveLine(-1)}>
              Previous
            </Button>
            <Button variant="glow" onClick={markCurrentTimestamp}>
              Mark timestamp
            </Button>
            <Button variant="outline" onClick={() => moveLine(1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function normalizePlainLyrics(rawLyrics: string) {
  return rawLyrics
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function readLocalDraft(storageKey: string): Partial<Draft> | null {
  const rawDraft = window.localStorage.getItem(storageKey);
  if (!rawDraft) {
    return null;
  }

  try {
    return JSON.parse(rawDraft) as Partial<Draft>;
  } catch {
    return null;
  }
}

function findActiveLineIndex(lines: LyricLine[], elapsedMs: number) {
  let activeIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const startMs = lines[index]?.startMs;
    if (startMs != null && startMs <= elapsedMs) {
      activeIndex = index;
    }
  }

  return activeIndex;
}

function formatMs(ms: number) {
  const safeMs = Math.max(0, Math.round(ms));
  const minutes = Math.floor(safeMs / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1_000);
  const centiseconds = Math.floor((safeMs % 1_000) / 10);

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
}

function formatSyncedLyrics(lines: LyricLine[]) {
  return lines
    .filter((line) => line.text.trim())
    .map((line) =>
      line.startMs == null
        ? line.text.trim()
        : `[${formatMs(line.startMs)}] ${line.text.trim()}`,
    )
    .join("\n");
}
