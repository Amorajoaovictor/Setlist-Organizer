"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
import type { SetlistSong } from "@workspace/api-client-react";

import { cn } from "@/lib/utils";

type LyricLine = {
  index: number;
  text: string;
  startMs: number | null;
};

type StoredLyrics = {
  source: "lrclib" | "manual";
  lrclibId: number | null;
  plainLyrics: string;
  syncedLyrics: string | null;
  lines: LyricLine[];
  bpm: number | null;
};

type PresentationLyrics = {
  lines: LyricLine[];
  bpm: number;
};

export function SetlistPresentationMode({
  setlistId,
  setlistName,
  songs,
}: {
  setlistId: number;
  setlistName: string;
  songs: SetlistSong[];
}) {
  const router = useRouter();
  const audioContextRef = useRef<AudioContext | null>(null);
  const countInTimeoutRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [countInValue, setCountInValue] = useState<number | null>(4);
  const [activeSongIndex, setActiveSongIndex] = useState(0);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [beat, setBeat] = useState(1);
  const [lyricsBySongId, setLyricsBySongId] = useState<
    Record<number, PresentationLyrics>
  >({});
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

  const activeSong = songs[activeSongIndex] ?? null;
  const activeLyrics = activeSong ? lyricsBySongId[activeSong.id] : null;
  const activeLines = activeLyrics?.lines ?? [];
  const activeBpm = activeLyrics?.bpm ?? 120;
  const currentLine = activeLines[activeLineIndex] ?? null;
  const previousLines = activeLines.slice(
    Math.max(0, activeLineIndex - 2),
    activeLineIndex,
  );
  const nextLines = activeLines.slice(activeLineIndex + 1, activeLineIndex + 3);
  const songDurationMs = useMemo(
    () => getPresentationSongDuration(activeSong, activeLines, activeBpm),
    [activeSong, activeLines, activeBpm],
  );
  const playbackProgress =
    songDurationMs > 0 ? Math.min(100, (elapsedMs / songDurationMs) * 100) : 0;
  const isCountingIn = countInValue !== null;

  useEffect(() => {
    let cancelled = false;

    async function loadLyrics() {
      setIsLoadingLyrics(true);
      const entries = await Promise.all(
        songs.map(async (song) => {
          try {
            const response = await fetch(
              `/api/setlists/${setlistId}/songs/${song.id}/lyrics`,
            );
            if (!response.ok) {
              return [song.id, createFallbackLyrics(song)] as const;
            }

            const payload = (await response.json()) as StoredLyrics;
            const lines =
              payload.lines.length > 0
                ? payload.lines
                : normalizePlainLyrics(payload.plainLyrics).map(
                    (text, index) => ({
                      index,
                      text,
                      startMs: null,
                    }),
                  );

            return [
              song.id,
              {
                bpm: payload.bpm ?? 120,
                lines:
                  lines.length > 0 ? lines : createFallbackLyrics(song).lines,
              },
            ] as const;
          } catch {
            return [song.id, createFallbackLyrics(song)] as const;
          }
        }),
      );

      if (!cancelled) {
        setLyricsBySongId(Object.fromEntries(entries));
        setIsLoadingLyrics(false);
      }
    }

    void loadLyrics();

    return () => {
      cancelled = true;
    };
  }, [setlistId, songs]);

  useEffect(() => {
    if (countInValue === null) {
      return;
    }

    if (countInValue <= 0) {
      countInTimeoutRef.current = window.setTimeout(() => {
        countInTimeoutRef.current = null;
        setCountInValue(null);
        setIsPlaying(true);
      }, 450);
      return () => clearCountInTimeout();
    }

    playClick(countInValue === 4);
    countInTimeoutRef.current = window.setTimeout(() => {
      countInTimeoutRef.current = null;
      setCountInValue((current) =>
        current === null ? null : Math.max(current - 1, 0),
      );
    }, 1_000);

    return () => clearCountInTimeout();
  }, [countInValue]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedMs((current) => current + 100);
    }, 100);

    return () => window.clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    let currentBeat = 0;
    const intervalMs = 60_000 / activeBpm;
    const tick = () => {
      currentBeat = (currentBeat % 4) + 1;
      setBeat(currentBeat);
      playClick(currentBeat === 1);
    };

    tick();
    const interval = window.setInterval(tick, intervalMs);

    return () => window.clearInterval(interval);
  }, [activeBpm, activeSong?.id, isPlaying]);

  useEffect(() => {
    if (activeLines.length === 0) {
      return;
    }

    setActiveLineIndex(findActiveLineIndex(activeLines, elapsedMs, activeBpm));
  }, [activeBpm, activeLines, elapsedMs]);

  useEffect(() => {
    if (
      !isPlaying ||
      !activeSong ||
      isLoadingLyrics ||
      elapsedMs < songDurationMs
    ) {
      return;
    }

    if (activeSongIndex < songs.length - 1) {
      goToSong(activeSongIndex + 1, { startCountIn: true });
      return;
    }

    setIsPlaying(false);
  }, [
    activeSong,
    activeSongIndex,
    elapsedMs,
    isLoadingLyrics,
    isPlaying,
    songDurationMs,
    songs.length,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        router.push(`/setlists/${setlistId}`);
      }
      if (event.key === " ") {
        event.preventDefault();
        togglePlayback();
      }
      if (event.key === "ArrowRight") {
        goToSong(activeSongIndex + 1);
      }
      if (event.key === "ArrowLeft") {
        goToSong(activeSongIndex - 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSongIndex, isCountingIn, isPlaying, router, setlistId]);

  function clearCountInTimeout() {
    if (countInTimeoutRef.current !== null) {
      window.clearTimeout(countInTimeoutRef.current);
      countInTimeoutRef.current = null;
    }
  }

  function startCountIn() {
    clearCountInTimeout();
    setIsPlaying(false);
    setCountInValue(4);
    setBeat(1);
  }

  function pausePlayback() {
    clearCountInTimeout();
    setCountInValue(null);
    setIsPlaying(false);
  }

  function togglePlayback() {
    if (isPlaying || isCountingIn) {
      pausePlayback();
      return;
    }

    startCountIn();
  }

  function goToSong(
    nextIndex: number,
    options: { startCountIn?: boolean } = {},
  ) {
    const boundedIndex = Math.min(
      Math.max(nextIndex, 0),
      Math.max(songs.length - 1, 0),
    );
    const shouldStartCountIn =
      options.startCountIn ?? (isPlaying || isCountingIn);

    setActiveSongIndex(boundedIndex);
    setActiveLineIndex(0);
    setElapsedMs(0);
    setBeat(1);
    setIsPlaying(false);

    if (shouldStartCountIn) {
      startCountIn();
    } else {
      clearCountInTimeout();
      setCountInValue(null);
    }
  }

  function moveLine(direction: -1 | 1) {
    const nextIndex = Math.min(
      Math.max(activeLineIndex + direction, 0),
      Math.max(activeLines.length - 1, 0),
    );
    setActiveLineIndex(nextIndex);
    if (activeLines[nextIndex]) {
      setElapsedMs(
        getLineStartMs(activeLines[nextIndex], nextIndex, activeBpm),
      );
    }
  }

  function playClick(accent: boolean) {
    try {
      const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioContextRef.current ??= new AudioContextClass();
      const context = audioContextRef.current;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.frequency.value = accent ? 1_100 : 760;
      gain.gain.value = accent ? 0.16 : 0.08;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.035);
    } catch {
      // Audio may be blocked by the browser; visual timing continues.
    }
  }

  if (songs.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#020407] px-6 text-center text-white">
        <h1 className="font-display text-3xl font-bold">Setlist vazia</h1>
        <p className="max-w-md text-zinc-400">
          Adicione musicas antes de iniciar o modo apresentacao.
        </p>
        <Link
          href={`/setlists/${setlistId}`}
          className="rounded-xl border border-cyan-300/30 px-5 py-3 font-medium text-cyan-100 transition hover:bg-cyan-300/10"
        >
          Voltar para setlist
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen min-h-screen flex-col overflow-hidden bg-[#020407] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(236,72,153,0.035)_1px,transparent_1px)] bg-[size:72px_72px] opacity-70" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-400/10 to-transparent" />

      {(isCountingIn || !isPlaying) && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center overflow-hidden bg-black/55 px-6 text-center backdrop-blur-[1px]">
          <div
            key={isCountingIn ? countInValue : "paused"}
            className={cn(
              "relative flex aspect-square w-[min(78vw,28rem)] items-center justify-center overflow-hidden rounded-full border bg-zinc-950/80 shadow-[0_0_90px_rgba(34,211,238,0.2)]",
              isCountingIn
                ? "border-cyan-100/60 text-cyan-50"
                : "border-fuchsia-200/45 text-fuchsia-50",
            )}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:18px_18px] opacity-35" />
            <div className="absolute inset-[7%] rounded-full border border-white/55" />
            <div className="absolute inset-[18%] rounded-full border border-white/25" />
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/35" />
            <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/35" />
            {isCountingIn && (
              <div className="absolute left-1/2 top-1/2 h-[150%] w-[150%] origin-top-left -translate-x-px -translate-y-px rotate-[-42deg] bg-[conic-gradient(from_0deg,rgba(34,211,238,0.34)_0deg,rgba(34,211,238,0.18)_38deg,transparent_39deg)]" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),transparent_20%,transparent_80%,rgba(0,0,0,0.35))]" />

            <div className="relative z-10 flex flex-col items-center">
              <p className="text-xs font-bold uppercase tracking-[0.55em] text-white/55 sm:text-sm">
                {isCountingIn ? "Entrada" : "Pausado"}
              </p>
              <p
                className={cn(
                  "mt-4 flex h-[0.9em] min-w-[1.45em] items-center justify-center font-black leading-none tracking-normal text-cyan-100 [font-variant-numeric:tabular-nums] [text-shadow:0_0_28px_rgba(34,211,238,0.55)]",
                  countInValue === 0
                    ? "text-[clamp(3.25rem,12vw,7rem)]"
                    : "text-[clamp(5.5rem,22vw,13rem)]",
                )}
              >
                {isCountingIn
                  ? countInValue === 0
                    ? "Vai"
                    : countInValue
                  : "II"}
              </p>
              <p className="mt-2 max-w-64 text-xs font-semibold uppercase tracking-[0.25em] text-white/45 sm:text-sm">
                {isCountingIn ? "Stand by" : "Play para voltar"}
              </p>
            </div>
          </div>
        </div>
      )}

      <header className="relative z-10 flex h-20 flex-shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-black/60 px-4 backdrop-blur-xl sm:px-8">
        <Link
          href={`/setlists/${setlistId}`}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition hover:border-cyan-300/50 hover:text-cyan-200"
          aria-label="Voltar para setlist"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-xs font-semibold uppercase text-cyan-200/70">
            {setlistName}
          </p>
          <h2 className="truncate font-display text-xl font-bold text-white sm:text-3xl">
            {activeSong?.title ?? "Setlist"}
          </h2>
          <p className="truncate text-sm text-zinc-400">{activeSong?.artist}</p>
        </div>

        <div className="flex h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 font-mono text-sm font-bold text-cyan-200">
          {activeSongIndex + 1}/{songs.length}
        </div>
      </header>

      <main className="relative z-10 grid flex-1 grid-rows-[1fr_auto_1fr] px-5 pb-56 pt-6 text-center sm:px-10 sm:pb-40">
        <div className="flex flex-col items-center justify-end gap-3 pb-6 text-xl font-semibold leading-tight text-zinc-500 sm:text-3xl">
          {previousLines.map((line) => (
            <p
              key={`previous-${activeSong?.id}-${line.index}`}
              className="max-w-5xl"
            >
              {line.text}
            </p>
          ))}
        </div>

        <div className="flex min-h-[28vh] items-center justify-center border-y border-cyan-300/10 py-6">
          <p className="max-w-6xl break-words text-[clamp(2.25rem,5.8vw,5.75rem)] font-black leading-[1.08] text-cyan-100 [overflow-wrap:anywhere] [text-shadow:0_0_22px_rgba(34,211,238,0.45)]">
            {isLoadingLyrics
              ? "Carregando letras"
              : (currentLine?.text ?? activeSong?.title ?? "Sem musica")}
          </p>
        </div>

        <div className="flex flex-col items-center justify-start gap-3 pt-6 text-xl font-semibold leading-tight text-zinc-500 sm:text-3xl">
          {nextLines.map((line) => (
            <p
              key={`next-${activeSong?.id}-${line.index}`}
              className="max-w-5xl"
            >
              {line.text}
            </p>
          ))}
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/80 px-4 py-4 backdrop-blur-xl sm:px-8">
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400"
            style={{ width: `${playbackProgress}%` }}
          />
        </div>

        <div className="grid items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <button
              type="button"
              onClick={() => goToSong(activeSongIndex - 1)}
              disabled={activeSongIndex === 0}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-zinc-300 transition hover:border-cyan-300/50 hover:text-cyan-200 disabled:opacity-30"
              aria-label="Musica anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={togglePlayback}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 transition hover:bg-cyan-300/20"
              aria-label={
                isPlaying || isCountingIn
                  ? "Pausar apresentacao"
                  : "Tocar apresentacao"
              }
            >
              {isPlaying || isCountingIn ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => goToSong(activeSongIndex + 1)}
              disabled={activeSongIndex >= songs.length - 1}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-zinc-300 transition hover:border-cyan-300/50 hover:text-cyan-200 disabled:opacity-30"
              aria-label="Proxima musica"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="flex min-w-0 gap-2 overflow-x-auto py-1">
            {songs.map((song, index) => (
              <button
                key={song.id}
                type="button"
                onClick={() => goToSong(index)}
                className={cn(
                  "min-w-36 rounded-lg border px-3 py-2 text-left transition",
                  index === activeSongIndex
                    ? "border-cyan-300/70 bg-cyan-300/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-zinc-500 hover:border-white/25",
                )}
              >
                <p className="truncate text-xs font-semibold uppercase">
                  {index + 1}
                </p>
                <p className="truncate text-sm font-bold">{song.title}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-64">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="text-xs uppercase text-zinc-500">Tempo</p>
              <p className="font-mono text-sm text-cyan-100">
                {formatMs(elapsedMs)}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="text-xs uppercase text-zinc-500">BPM</p>
              <p className="font-mono text-sm text-cyan-100">{activeBpm}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="text-xs uppercase text-zinc-500">
                {isCountingIn ? "Entrada" : "Beat"}
              </p>
              <p className="font-mono text-sm text-cyan-100">
                {isCountingIn
                  ? countInValue === 0
                    ? "Vai"
                    : countInValue
                  : beat}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => moveLine(-1)}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300"
          >
            Linha anterior
          </button>
          <button
            type="button"
            onClick={() => moveLine(1)}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300"
          >
            Proxima linha
          </button>
        </div>
      </footer>
    </div>
  );
}

function createFallbackLyrics(song: SetlistSong): PresentationLyrics {
  return {
    bpm: 120,
    lines: [
      { index: 0, text: song.title, startMs: 0 },
      { index: 1, text: song.artist, startMs: null },
    ],
  };
}

function normalizePlainLyrics(rawLyrics: string) {
  return rawLyrics
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function findActiveLineIndex(
  lines: LyricLine[],
  elapsedMs: number,
  bpm: number,
) {
  let activeIndex = 0;

  for (let index = 0; index < lines.length; index += 1) {
    if (getLineStartMs(lines[index], index, bpm) <= elapsedMs) {
      activeIndex = index;
    }
  }

  return activeIndex;
}

function getLineStartMs(line: LyricLine, index: number, bpm: number) {
  return line.startMs ?? Math.round(index * getFallbackLineDurationMs(bpm));
}

function getFallbackLineDurationMs(bpm: number) {
  const safeBpm = Math.min(Math.max(bpm, 30), 300);
  return (60_000 / safeBpm) * 4;
}

function getPresentationSongDuration(
  song: SetlistSong | null,
  lines: LyricLine[],
  bpm: number,
) {
  const lineDurationMs = getFallbackLineDurationMs(bpm);
  const lastLineStartMs =
    lines.length > 0
      ? getLineStartMs(lines[lines.length - 1], lines.length - 1, bpm)
      : 0;
  const lyricsDurationMs = lastLineStartMs + lineDurationMs;

  return Math.max(song?.durationMs ?? 0, lyricsDurationMs, lineDurationMs);
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
