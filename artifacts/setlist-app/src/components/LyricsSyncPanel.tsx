"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  FileText,
  Gauge,
  ListMusic,
  Loader2,
  Mic2,
  Pause,
  Play,
  Save,
  Search,
  SlidersHorizontal,
  Timer,
  Upload,
} from "lucide-react";
import type { SetlistSong } from "@workspace/api-client-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { KaraokeStemPanel } from "@/components/KaraokeStemPanel";
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

const WAVEFORM_BAR_COUNT = 96;

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type YouTubePlayerEvent = {
  target: YouTubePlayer;
};

type YouTubePlayerStateChangeEvent = YouTubePlayerEvent & {
  data: number;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (event: YouTubePlayerEvent) => void;
        onStateChange?: (event: YouTubePlayerStateChangeEvent) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: {
    PLAYING: number;
  };
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

export function LyricsSyncPanel({
  setlistId,
  song,
}: {
  setlistId: number;
  song: SetlistSong | null;
}) {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubeContainerRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const youtubeIsPlayingRef = useRef(false);
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
  const [localAudioUrl, setLocalAudioUrl] = useState("");
  const [localAudioFile, setLocalAudioFile] = useState<File | null>(null);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>(() =>
    createFallbackWaveform(WAVEFORM_BAR_COUNT, 1),
  );
  const [waveformStatus, setWaveformStatus] = useState<"idle" | "loading" | "ready" | "fallback">(
    "idle",
  );

  const storageKey = song
    ? `setlist:${setlistId}:song:${song.id}:lyrics-draft`
    : null;

  const currentLine = draft.lines[selectedLine] ?? null;
  const syncedCount = draft.lines.filter((line) => line.startMs != null).length;
  const youtubeVideoId = useMemo(
    () => (localAudioUrl ? null : getYouTubeVideoId(draft.audioUrl)),
    [draft.audioUrl, localAudioUrl],
  );
  const previewAudioSrc = localAudioUrl || (youtubeVideoId ? "" : draft.audioUrl);
  const hasPreviewSource = Boolean(previewAudioSrc || youtubeVideoId);
  const syncProgress =
    draft.lines.length > 0 ? Math.round((syncedCount / draft.lines.length) * 100) : 0;
  const songDurationMs = song?.durationMs ?? 0;
  const seekableDurationMs = audioDurationMs || songDurationMs;
  const playbackProgress =
    seekableDurationMs > 0 ? Math.min(100, (elapsedMs / seekableDurationMs) * 100) : 0;

  const syncedLyricsText = useMemo(() => formatSyncedLyrics(draft.lines), [draft.lines]);

  useEffect(() => {
    stopMetronome();
    setSelectedLine(0);
    setElapsedMs(0);
    setLocalAudioUrl("");
    setLocalAudioFile(null);

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
      const youtubePlayer = youtubePlayerRef.current;
      if (youtubePlayer && youtubeVideoId) {
        const nextElapsedMs = Math.round(youtubePlayer.getCurrentTime() * 1_000);
        setElapsedMs(nextElapsedMs);

        const nextDurationMs = Math.round(youtubePlayer.getDuration() * 1_000);
        if (nextDurationMs > 0) {
          setAudioDurationMs(nextDurationMs);
        }

        if (youtubeIsPlayingRef.current) {
          const activeIndex = findActiveLineIndex(draft.lines, nextElapsedMs);
          if (activeIndex >= 0) {
            setSelectedLine(activeIndex);
          }
        }

        return;
      }

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
  }, [draft.lines, youtubeVideoId]);

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

  useEffect(() => {
    let cancelled = false;
    const seed = song ? song.id + song.title.length + song.artist.length : 1;

    setWaveformBars(createFallbackWaveform(WAVEFORM_BAR_COUNT, seed));
    setAudioDurationMs(0);

    if (youtubeVideoId) {
      setWaveformStatus("fallback");
      return () => {
        cancelled = true;
      };
    }

    if (!previewAudioSrc) {
      setWaveformStatus("idle");
      return () => {
        cancelled = true;
      };
    }

    setWaveformStatus("loading");

    async function loadWaveform() {
      let context: AudioContext | null = null;

      try {
        const response = await fetch(previewAudioSrc);
        if (!response.ok) {
          throw new Error("Audio source could not be read");
        }

        const audioData = await response.arrayBuffer();
        const AudioContextClass = getAudioContextClass();
        if (!AudioContextClass) {
          throw new Error("AudioContext is not available");
        }

        context = new AudioContextClass();
        const audioBuffer = await context.decodeAudioData(audioData.slice(0));

        if (cancelled) {
          return;
        }

        setWaveformBars(buildWaveformBars(audioBuffer, WAVEFORM_BAR_COUNT));
        setAudioDurationMs(Math.round(audioBuffer.duration * 1_000));
        setWaveformStatus("ready");
      } catch {
        if (!cancelled) {
          setWaveformStatus("fallback");
        }
      } finally {
        if (context) {
          void context.close();
        }
      }
    }

    void loadWaveform();

    return () => {
      cancelled = true;
    };
  }, [previewAudioSrc, song, youtubeVideoId]);

  useEffect(() => {
    let cancelled = false;
    youtubeIsPlayingRef.current = false;

    if (!youtubeVideoId) {
      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
      return;
    }

    const activeYoutubeVideoId = youtubeVideoId;
    const container = youtubeContainerRef.current;
    if (!container) {
      return;
    }

    setAudioDurationMs(0);

    async function loadPlayer() {
      try {
        const api = await loadYouTubeIframeApi();
        if (cancelled || !youtubeContainerRef.current) {
          return;
        }

        youtubePlayerRef.current?.destroy();
        youtubePlayerRef.current = new api.Player(youtubeContainerRef.current, {
          videoId: activeYoutubeVideoId,
          playerVars: {
            controls: 1,
            modestbranding: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              if (cancelled) {
                return;
              }

              const durationMs = Math.round(event.target.getDuration() * 1_000);
              if (durationMs > 0) {
                setAudioDurationMs(durationMs);
              }
            },
            onStateChange: (event) => {
              youtubeIsPlayingRef.current = event.data === api.PlayerState.PLAYING;
            },
          },
        });
      } catch {
        if (!cancelled) {
          toast({
            title: "Nao foi possivel carregar o YouTube",
            description: "Use um arquivo local ou uma URL direta de audio para continuar.",
            variant: "destructive",
          });
        }
      }
    }

    void loadPlayer();

    return () => {
      cancelled = true;
      youtubeIsPlayingRef.current = false;
      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
    };
  }, [toast, youtubeVideoId]);

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
    const youtubePlayer = youtubePlayerRef.current;
    if (youtubePlayer && youtubeVideoId) {
      const timestampMs = Math.round(youtubePlayer.getCurrentTime() * 1_000);
      markLineAt(timestampMs);
      return;
    }

    const audio = audioRef.current;
    const timestampMs = audio ? Math.round(audio.currentTime * 1_000) : elapsedMs;

    markLineAt(timestampMs);
  }

  function markLineAt(timestampMs: number) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line, index) =>
        index === selectedLine ? { ...line, startMs: timestampMs } : line,
      ),
    }));
    setSelectedLine((current) => Math.min(current + 1, draft.lines.length - 1));
  }

  function updateLineTimestamp(index: number, value: string) {
    const seconds = Number.parseFloat(value);
    const timestampMs = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 1_000)) : null;

    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, startMs: timestampMs } : line,
      ),
    }));
  }

  function moveLine(direction: -1 | 1) {
    setSelectedLine((current) =>
      Math.min(Math.max(current + direction, 0), Math.max(draft.lines.length - 1, 0)),
    );
  }

  function seekAudio(nextElapsedMs: number) {
    const durationMs = seekableDurationMs;
    const safeElapsedMs =
      durationMs > 0 ? Math.min(Math.max(nextElapsedMs, 0), durationMs) : Math.max(nextElapsedMs, 0);
    const youtubePlayer = youtubePlayerRef.current;

    if (youtubePlayer && youtubeVideoId) {
      youtubePlayer.seekTo(safeElapsedMs / 1_000, true);
      setElapsedMs(Math.round(safeElapsedMs));

      const activeIndex = findActiveLineIndex(draft.lines, safeElapsedMs);
      if (activeIndex >= 0) {
        setSelectedLine(activeIndex);
      }

      return;
    }

    const audio = audioRef.current;

    if (audio && previewAudioSrc) {
      audio.currentTime = safeElapsedMs / 1_000;
    }

    setElapsedMs(Math.round(safeElapsedMs));

    const activeIndex = findActiveLineIndex(draft.lines, safeElapsedMs);
    if (activeIndex >= 0) {
      setSelectedLine(activeIndex);
    }
  }

  function updateAudioDuration() {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
      setAudioDurationMs(songDurationMs);
      return;
    }

    setAudioDurationMs(Math.round(audio.duration * 1_000));
  }

  function selectLocalAudio(file: File | undefined) {
    if (!file) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLocalAudioUrl(objectUrl);
    setLocalAudioFile(file);
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
          Selecione uma faixa para abrir o editor de sincronizacao.
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-cyan-400/15 bg-[#050712]/95 p-3 shadow-2xl shadow-cyan-950/40 sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
        <div className="absolute left-[-20%] top-[-35%] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-[-30%] right-[-15%] h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 sm:tracking-[0.2em]">
              <Mic2 className="h-3.5 w-3.5" />
              <span className="truncate">Editor de Sincronizacao de Karaoke</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
              Neon Lyric Sync
            </h2>
            <p className="truncate text-sm text-slate-400">
              {song.title} - {song.artist}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 lg:flex lg:flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={searchLrclib}
              disabled={isSearching}
              className="w-full lg:w-auto"
            >
              {isSearching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Buscar LRCLIB
            </Button>
            <Button
              size="sm"
              variant="glow"
              onClick={saveLyrics}
              disabled={isSaving}
              className="w-full lg:w-auto"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando letras
          </div>
        ) : (
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.35fr)]">
            <div className="min-w-0 space-y-4">
              <div className="rounded-xl border border-white/10 bg-black/35 p-3 sm:p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <FileText className="h-4 w-4 text-cyan-300" />
                    Letra base
                  </div>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400">
                    {draft.source === "lrclib" ? "LRCLIB" : "Manual"}
                  </span>
                </div>
                <textarea
                  value={draft.plainLyrics}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      source: "manual",
                      plainLyrics: event.target.value,
                    }))
                  }
                  className="min-h-56 w-full resize-y rounded-xl border border-cyan-300/10 bg-slate-950/80 p-3 text-sm leading-6 text-slate-100 outline-none ring-cyan-300/30 transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-2"
                  placeholder="Cole a letra aqui, uma frase por linha."
                />
                <Button variant="outline" onClick={applyPlainLyrics} className="mt-3 w-full">
                  <ListMusic className="mr-2 h-4 w-4" />
                  Separar linhas para sincronizar
                </Button>
              </div>

              <div className="space-y-3 rounded-xl border border-white/10 bg-black/35 p-3 sm:p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <SlidersHorizontal className="h-4 w-4 text-fuchsia-300" />
                  Audio e metronomo
                </div>
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <Upload className="h-3.5 w-3.5" />
                    Arquivo local para preview
                  </span>
                  <Input
                    type="file"
                    accept="audio/*"
                    onChange={(event) => selectLocalAudio(event.target.files?.[0])}
                    className="border-cyan-300/10 bg-slate-950/70"
                  />
                </label>
                <Input
                  value={draft.audioUrl}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, audioUrl: event.target.value }))
                  }
                  className="border-cyan-300/10 bg-slate-950/70"
                  placeholder="URL temporaria de audio para preview"
                />
                {youtubeVideoId ? (
                  <>
                    <div className="overflow-hidden rounded-xl border border-cyan-300/10 bg-black">
                      <div ref={youtubeContainerRef} className="aspect-video w-full" />
                    </div>
                    <audio ref={audioRef} className="hidden" />
                  </>
                ) : previewAudioSrc ? (
                  <audio
                    ref={audioRef}
                    src={previewAudioSrc}
                    controls
                    className="w-full"
                    onDurationChange={updateAudioDuration}
                    onLoadedMetadata={updateAudioDuration}
                    onTimeUpdate={(event) =>
                      setElapsedMs(Math.round(event.currentTarget.currentTime * 1_000))
                    }
                  />
                ) : (
                  <audio ref={audioRef} className="hidden" />
                )}
                <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="relative">
                    <Gauge className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
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
                      className="border-cyan-300/10 bg-slate-950/70 pl-10"
                    />
                  </label>
                  <Button
                    variant={metronomeOn ? "secondary" : "outline"}
                    onClick={startMetronome}
                    className={cn(metronomeOn ? "border-fuchsia-300/40 text-fuchsia-100" : "")}
                  >
                    {metronomeOn ? (
                      <Pause className="mr-2 h-4 w-4" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    {metronomeOn ? "Parar" : "Click"}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Tempo</p>
                    <p className="font-mono text-lg text-cyan-200">{formatMs(elapsedMs)}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      {countIn ? "Entrada" : "Sincronizado"}
                    </p>
                    <p className="font-mono text-lg text-fuchsia-200">
                      {countIn ? countIn : `${syncedCount}/${draft.lines.length}`}
                    </p>
                  </div>
                </div>
                <KaraokeStemPanel
                  audioFile={localAudioFile}
                  hasPreviewSource={hasPreviewSource}
                  hasLocalAudio={Boolean(localAudioUrl)}
                />
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="rounded-xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 via-white/[0.04] to-fuchsia-400/10 p-3 shadow-xl shadow-cyan-950/30 sm:p-4">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 sm:tracking-[0.2em]">
                      <Activity className="h-3.5 w-3.5" />
                      Linha atual
                    </p>
                    <p className="mt-2 break-words text-lg font-bold leading-snug text-white sm:text-2xl">
                      {currentLine?.text ?? "Nenhuma linha selecionada"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-cyan-300/20 bg-black/40 px-3 py-3 text-left sm:px-4 sm:text-right">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Marcacao</p>
                    <p className="font-mono text-xl text-cyan-200 sm:text-2xl">
                      {currentLine?.startMs == null ? "--:--.--" : formatMs(currentLine.startMs)}
                    </p>
                  </div>
                </div>

                <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400"
                    style={{ width: `${playbackProgress}%` }}
                  />
                </div>

                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2">
                  <Button variant="outline" onClick={() => moveLine(-1)} aria-label="Linha anterior">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="glow"
                    onClick={markCurrentTimestamp}
                    disabled={draft.lines.length === 0}
                    className="min-w-0 px-3 text-xs sm:text-sm"
                  >
                    <span className="truncate">Marcar tempo da linha</span>
                  </Button>
                  <Button variant="outline" onClick={() => moveLine(1)} aria-label="Proxima linha">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Progresso da sincronizacao</span>
                    <span>{syncProgress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-cyan-300"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              <AudioWaveformSeek
                bars={waveformBars}
                disabled={!hasPreviewSource || seekableDurationMs <= 0}
                durationMs={seekableDurationMs}
                elapsedMs={elapsedMs}
                status={waveformStatus}
                onSeek={seekAudio}
              />

              <div className="min-w-0 rounded-xl border border-white/10 bg-black/35 p-3">
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ListMusic className="h-4 w-4 text-cyan-300" />
                    Timeline da letra
                  </div>
                  <span className="text-xs text-slate-500">{draft.lines.length} linhas</span>
                </div>
                <div className="max-h-[31rem] space-y-2 overflow-y-auto pr-1">
                  {draft.lines.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-cyan-300/20 p-8 text-center text-sm text-slate-500">
                      Busque no LRCLIB ou separe a letra colada para criar as linhas de sync.
                    </div>
                  ) : (
                    draft.lines.map((line, index) => (
                      <div
                        key={`${line.index}-${index}`}
                        className={cn(
                          "grid min-w-0 gap-3 rounded-xl border p-3 text-sm transition min-[420px]:grid-cols-[3rem_minmax(0,1fr)] sm:grid-cols-[3rem_minmax(0,1fr)_6.5rem]",
                          selectedLine === index
                            ? "border-cyan-300/60 bg-cyan-300/10 text-white shadow-lg shadow-cyan-950/30"
                            : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedLine(index)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/30 font-mono text-xs text-slate-300"
                          aria-label={`Selecionar linha ${index + 1}`}
                        >
                          {(index + 1).toString().padStart(2, "0")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedLine(index)}
                          className="min-w-0 text-left leading-5"
                        >
                          <span className="line-clamp-2 break-words">{line.text}</span>
                        </button>
                        <label className="flex min-w-0 items-center gap-2 min-[420px]:col-span-2 sm:col-span-1">
                          <Timer className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.startMs == null ? "" : (line.startMs / 1_000).toFixed(2)}
                            onChange={(event) => updateLineTimestamp(index, event.target.value)}
                            onFocus={() => setSelectedLine(index)}
                            className="h-9 rounded-lg border-cyan-300/10 bg-slate-950/70 px-2 font-mono text-xs"
                            placeholder="--"
                            aria-label={`Tempo em segundos da linha ${index + 1}`}
                          />
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function normalizePlainLyrics(rawLyrics: string) {
  return rawLyrics
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function getYouTubeVideoId(rawUrl: string) {
  const normalizedUrl = rawUrl.trim();
  if (!normalizedUrl) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(normalizedUrl);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  if (!isYouTubeHostname(hostname)) {
    return null;
  }

  if (hostname === "youtu.be") {
    return normalizeYouTubeVideoId(url.pathname.split("/").filter(Boolean)[0]);
  }

  const watchVideoId = normalizeYouTubeVideoId(url.searchParams.get("v"));
  if (watchVideoId) {
    return watchVideoId;
  }

  const [section, videoId] = url.pathname.split("/").filter(Boolean);
  if (section && ["embed", "live", "shorts", "v"].includes(section)) {
    return normalizeYouTubeVideoId(videoId);
  }

  return null;
}

function isYouTubeHostname(hostname: string) {
  return (
    hostname === "youtu.be" ||
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "youtube-nocookie.com" ||
    hostname.endsWith(".youtube-nocookie.com")
  );
}

function normalizeYouTubeVideoId(videoId: string | null | undefined) {
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return null;
  }

  return videoId;
}

function loadYouTubeIframeApi() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  youtubeApiPromise ??= new Promise<YouTubeApi>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();

      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error("YouTube IFrame API is unavailable"));
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("YouTube IFrame API failed to load"));
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
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

function AudioWaveformSeek({
  bars,
  disabled,
  durationMs,
  elapsedMs,
  status,
  onSeek,
}: {
  bars: number[];
  disabled: boolean;
  durationMs: number;
  elapsedMs: number;
  status: "idle" | "loading" | "ready" | "fallback";
  onSeek: (elapsedMs: number) => void;
}) {
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const progressRatio = durationMs > 0 ? Math.min(Math.max(elapsedMs / durationMs, 0), 1) : 0;
  const activeBars = Math.round(progressRatio * bars.length);
  const statusLabel =
    status === "loading"
      ? "Carregando"
      : status === "fallback"
        ? "Preview"
        : status === "ready"
          ? "Forma de onda"
          : "Audio";

  function seekFromPointer(clientX: number) {
    if (disabled || durationMs <= 0) {
      return;
    }

    const bounds = waveformRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) {
      return;
    }

    const ratio = Math.min(Math.max((clientX - bounds.left) / bounds.width, 0), 1);
    onSeek(ratio * durationMs);
  }

  return (
    <div className="rounded-xl border border-cyan-300/10 bg-slate-950/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span className="font-semibold uppercase tracking-wider">{statusLabel}</span>
        <span className="font-mono text-slate-400">
          {formatMs(elapsedMs)} / {formatMs(durationMs)}
        </span>
      </div>
      <div
        ref={waveformRef}
        role="slider"
        aria-label="Avancar ou retroceder audio"
        aria-valuemin={0}
        aria-valuemax={Math.max(durationMs, 0)}
        aria-valuenow={Math.min(Math.max(elapsedMs, 0), Math.max(durationMs, 0))}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          seekFromPointer(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1) {
            return;
          }

          seekFromPointer(event.clientX);
        }}
        onKeyDown={(event) => {
          if (disabled) {
            return;
          }

          const smallStepMs = 5_000;
          const largeStepMs = 15_000;

          if (event.key === "ArrowLeft") {
            event.preventDefault();
            onSeek(elapsedMs - smallStepMs);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            onSeek(elapsedMs + smallStepMs);
          } else if (event.key === "PageDown") {
            event.preventDefault();
            onSeek(elapsedMs - largeStepMs);
          } else if (event.key === "PageUp") {
            event.preventDefault();
            onSeek(elapsedMs + largeStepMs);
          } else if (event.key === "Home") {
            event.preventDefault();
            onSeek(0);
          } else if (event.key === "End") {
            event.preventDefault();
            onSeek(durationMs);
          }
        }}
        className={cn(
          "relative flex h-20 touch-none items-center gap-1 overflow-hidden rounded-lg border border-white/10 bg-black/35 px-2 outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-300/40",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-cyan-300/30",
        )}
      >
        <div
          className="pointer-events-none absolute inset-y-2 w-px bg-white shadow-[0_0_18px_rgba(255,255,255,0.8)]"
          style={{ left: `${progressRatio * 100}%` }}
        />
        {bars.map((bar, index) => {
          const isActive = index < activeBars;

          return (
            <span
              key={`${index}-${bar.toFixed(3)}`}
              className={cn(
                "min-w-0 flex-1 rounded-full transition-colors",
                isActive
                  ? "bg-gradient-to-t from-cyan-300 to-fuchsia-300"
                  : "bg-slate-700/80",
              )}
              style={{ height: `${Math.max(12, Math.round(bar * 100))}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

function buildWaveformBars(audioBuffer: AudioBuffer, barCount: number) {
  const channelCount = Math.min(audioBuffer.numberOfChannels, 2);
  const samplesPerBar = Math.max(1, Math.floor(audioBuffer.length / barCount));
  const bars: number[] = [];

  for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
    const start = barIndex * samplesPerBar;
    const end = Math.min(start + samplesPerBar, audioBuffer.length);
    const step = Math.max(1, Math.floor((end - start) / 250));
    let sum = 0;
    let samples = 0;

    for (let channel = 0; channel < channelCount; channel += 1) {
      const channelData = audioBuffer.getChannelData(channel);

      for (let sampleIndex = start; sampleIndex < end; sampleIndex += step) {
        const sample = channelData[sampleIndex] ?? 0;
        sum += sample * sample;
        samples += 1;
      }
    }

    bars.push(samples > 0 ? Math.sqrt(sum / samples) : 0);
  }

  const peak = Math.max(...bars, 0.001);
  return bars.map((bar) => Math.min(1, Math.max(0.08, Math.sqrt(bar / peak))));
}

function createFallbackWaveform(barCount: number, seed: number) {
  return Array.from({ length: barCount }, (_, index) => {
    const base = Math.sin((index + seed) * 0.47) * 0.22;
    const detail = Math.sin((index + seed) * 1.71) * 0.14;
    const swell = Math.sin((index / Math.max(barCount - 1, 1)) * Math.PI) * 0.3;

    return Math.min(1, Math.max(0.12, 0.42 + base + detail + swell));
  });
}

function getAudioContextClass() {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}
