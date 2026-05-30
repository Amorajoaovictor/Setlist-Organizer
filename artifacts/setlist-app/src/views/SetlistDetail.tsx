import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  ArrowLeft,
  Clock,
  GripVertical,
  Trash2,
  Edit2,
  Check,
  X,
  Music,
  AlertCircle,
  Loader2,
  FileText,
  Mic2,
  Gauge,
  Play,
  Pause,
  Save,
  Volume2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSetlist,
  useUpdateSetlist,
  useAddSongToSetlist,
  useRemoveSongFromSetlist,
  useReorderSetlistSongs,
  useDeleteSetlist,
  getGetSetlistQueryKey,
  getListSetlistsQueryKey,
  type DeezerTrack,
  type SetlistSong,
  type SetlistWithSongs,
} from "@workspace/api-client-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { DeezerSearch } from "@/components/DeezerSearch";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDuration, cn } from "@/lib/utils";

type LyricLine = {
  index: number;
  text: string;
  startMs: number | null;
};

type LrclibLyricsResult = {
  id: number;
  plainLyrics: string;
  syncedLyrics: string | null;
  lines: LyricLine[];
};

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type BpmPreset = {
  id: number;
  name: string;
  bpm: number;
  timeSignature: "2/4" | "3/4" | "4/4" | "6/8";
  accentFirstBeat: boolean;
  subdivision: 1 | 2 | 4;
  soundStyle: "classic" | "wood" | "soft";
  createdAt: string;
  updatedAt: string;
};

type TimeSignature = BpmPreset["timeSignature"];
type SoundStyle = BpmPreset["soundStyle"];
type Subdivision = "1" | "2" | "4";

const MIN_SONG_BPM = 30;
const MAX_SONG_BPM = 300;
const TAP_RESET_MS = 2200;
const timeSignatureOptions: Array<{ value: TimeSignature; label: string; beats: number }> = [
  { value: "2/4", label: "2/4", beats: 2 },
  { value: "3/4", label: "3/4", beats: 3 },
  { value: "4/4", label: "4/4", beats: 4 },
  { value: "6/8", label: "6/8", beats: 6 },
];
const soundOptions: Array<{ value: SoundStyle; label: string }> = [
  { value: "classic", label: "Click digital" },
  { value: "wood", label: "Wood block" },
  { value: "soft", label: "Pulso suave" },
];
const subdivisionOptions: Array<{ value: Subdivision; label: string }> = [
  { value: "1", label: "Sem subdivisao" },
  { value: "2", label: "Colcheias" },
  { value: "4", label: "Semicolcheias" },
];

function clampSongBpm(value: number) {
  return Math.min(MAX_SONG_BPM, Math.max(MIN_SONG_BPM, Math.round(value)));
}

function getBeatCount(signature: TimeSignature) {
  return timeSignatureOptions.find((option) => option.value === signature)?.beats ?? 4;
}

export default function SetlistDetail() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const setId = parseInt(id || "0", 10);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: setlist, isLoading, isError } = useGetSetlist(setId);

  const updateMutation = useUpdateSetlist();
  const addSongMutation = useAddSongToSetlist();
  const removeSongMutation = useRemoveSongFromSetlist();
  const reorderMutation = useReorderSetlistSongs();
  const deleteMutation = useDeleteSetlist();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bpmSong, setBpmSong] = useState<SetlistSong | null>(null);
  const [bpmDraft, setBpmDraft] = useState(120);
  const [bpmTimeSignature, setBpmTimeSignature] = useState<TimeSignature>("4/4");
  const [bpmAccentFirstBeat, setBpmAccentFirstBeat] = useState(true);
  const [bpmSubdivision, setBpmSubdivision] = useState<Subdivision>("1");
  const [bpmSoundStyle, setBpmSoundStyle] = useState<SoundStyle>("classic");
  const [isSavingBpm, setIsSavingBpm] = useState(false);
  const [isSavingBpmPreset, setIsSavingBpmPreset] = useState(false);
  const [bpmError, setBpmError] = useState<string | null>(null);
  const [isBpmPreviewPlaying, setIsBpmPreviewPlaying] = useState(false);
  const [previewBeat, setPreviewBeat] = useState(1);
  const [previewSubdivision, setPreviewSubdivision] = useState(0);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [bpmPresets, setBpmPresets] = useState<BpmPreset[]>([]);
  const [isLoadingBpmPresets, setIsLoadingBpmPresets] = useState(false);
  const [pendingLyricsSongIds, setPendingLyricsSongIds] = useState<Set<number>>(
    () => new Set(),
  );
  const audioContextRef = useRef<AudioContext | null>(null);
  const bpmPreviewTimerRef = useRef<number | null>(null);
  const bpmPreviewBeatRef = useRef(0);
  const bpmPreviewSubdivisionRef = useRef(0);
  const latestBpmStateRef = useRef({
    bpm: bpmDraft,
    timeSignature: bpmTimeSignature,
    accentFirstBeat: bpmAccentFirstBeat,
    subdivision: bpmSubdivision,
    soundStyle: bpmSoundStyle,
  });

  useEffect(() => {
    latestBpmStateRef.current = {
      bpm: bpmDraft,
      timeSignature: bpmTimeSignature,
      accentFirstBeat: bpmAccentFirstBeat,
      subdivision: bpmSubdivision,
      soundStyle: bpmSoundStyle,
    };
  }, [bpmAccentFirstBeat, bpmDraft, bpmSoundStyle, bpmSubdivision, bpmTimeSignature]);

  useEffect(() => {
    return () => {
      if (bpmPreviewTimerRef.current) {
        window.clearTimeout(bpmPreviewTimerRef.current);
      }
      void audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBpmPresets() {
      setIsLoadingBpmPresets(true);

      try {
        const response = await fetch("/api/bpm-presets");

        if (!response.ok) {
          throw new Error("Failed to load BPM presets");
        }

        const payload = (await response.json()) as BpmPreset[];

        if (!cancelled) {
          setBpmPresets(payload);
        }
      } catch {
        if (!cancelled) {
          setBpmPresets([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingBpmPresets(false);
        }
      }
    }

    void loadBpmPresets();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary opacity-50" />
        </div>
      </div>
    );
  }

  if (isError || !setlist) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center flex-col gap-4 text-destructive">
          <AlertCircle className="w-16 h-16" />
          <h2 className="text-2xl font-bold">Setlist not found</h2>
          <Link href="/">
            <Button variant="outline">Back to Setlists</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSaveName = () => {
    if (!editName.trim() || editName === setlist.name) {
      setIsEditingName(false);
      return;
    }
    updateMutation.mutate(
      { id: setId, data: { name: editName } },
      {
        onSuccess: () => {
          setIsEditingName(false);
          queryClient.invalidateQueries({
            queryKey: getGetSetlistQueryKey(setId),
          });
          queryClient.invalidateQueries({
            queryKey: getListSetlistsQueryKey(),
          });
        },
      },
    );
  };

  const importLyricsForSong = async (song: SetlistSong) => {
    setPendingLyricsSongIds((current) => new Set(current).add(song.id));

    try {
      const searchResponse = await fetch(
        `/api/setlists/${setId}/songs/${song.id}/lyrics/search`,
        { method: "POST" },
      );

      if (!searchResponse.ok) {
        return;
      }

      const lyrics = (await searchResponse.json()) as LrclibLyricsResult;
      const saveResponse = await fetch(
        `/api/setlists/${setId}/songs/${song.id}/lyrics`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "lrclib",
            lrclibId: lyrics.id || null,
            plainLyrics: lyrics.plainLyrics,
            syncedLyrics: lyrics.syncedLyrics,
            lines: lyrics.lines,
            bpm: song.bpm ?? null,
          }),
        },
      );

      if (!saveResponse.ok) {
        throw new Error("Failed to save LRCLIB lyrics");
      }
    } catch (error) {
      console.warn("Failed to import lyrics from LRCLIB after adding song", error);
    } finally {
      setPendingLyricsSongIds((current) => {
        const next = new Set(current);
        next.delete(song.id);
        return next;
      });
    }
  };

  const handleAddTrack = (track: DeezerTrack) => {
    addSongMutation.mutate(
      {
        id: setId,
        data: {
          title: track.title,
          artist: track.artist,
          durationMs: track.durationMs,
          bpm: track.bpm,
          deezerId: track.id,
          albumArt: track.albumArt,
        },
      },
      {
        onSuccess: (song) => {
          queryClient.setQueryData<SetlistWithSongs>(
            getGetSetlistQueryKey(setId),
            (current) =>
              current
                ? {
                    ...current,
                    songs: [...current.songs, song].sort(
                      (left, right) => left.position - right.position,
                    ),
                  }
                : current,
          );
          queryClient.invalidateQueries({
            queryKey: getGetSetlistQueryKey(setId),
          });
          queryClient.invalidateQueries({
            queryKey: getListSetlistsQueryKey(),
          });
          void importLyricsForSong(song);
        },
      },
    );
  };

  const handleRemoveSong = (songId: number) => {
    removeSongMutation.mutate(
      { id: setId, songId },
      {
        onSuccess: () => {
          setPendingLyricsSongIds((current) => {
            const next = new Set(current);
            next.delete(songId);
            return next;
          });
          queryClient.invalidateQueries({
            queryKey: getGetSetlistQueryKey(setId),
          });
          queryClient.invalidateQueries({
            queryKey: getListSetlistsQueryKey(),
          });
        },
      },
    );
  };

  const openBpmModal = (song: SetlistSong) => {
    setBpmSong(song);
    setBpmDraft(song.bpm ?? 120);
    setBpmTimeSignature("4/4");
    setBpmAccentFirstBeat(true);
    setBpmSubdivision("1");
    setBpmSoundStyle("classic");
    setBpmError(null);
    setTapTimes([]);
    setPreviewBeat(1);
    setPreviewSubdivision(0);
    setIsBpmPreviewPlaying(false);
  };

  const closeBpmModal = () => {
    setBpmSong(null);
    setIsBpmPreviewPlaying(false);
    if (bpmPreviewTimerRef.current) {
      window.clearTimeout(bpmPreviewTimerRef.current);
      bpmPreviewTimerRef.current = null;
    }
    setBpmError(null);
  };

  const scheduleBpmPreviewTick = () => {
    const state = latestBpmStateRef.current;
    const beatsPerBar = getBeatCount(state.timeSignature);
    const subdivisionCount = Number(state.subdivision);
    const currentBeat = bpmPreviewBeatRef.current;
    const currentSubdivision = bpmPreviewSubdivisionRef.current;
    const isDownbeat = currentBeat === 0 && currentSubdivision === 0;
    const isSubdivisionTick = currentSubdivision > 0;

    setPreviewBeat(currentBeat + 1);
    setPreviewSubdivision(currentSubdivision);
    playBpmPreviewClick(state.accentFirstBeat && isDownbeat, isSubdivisionTick);

    const nextSubdivision = currentSubdivision + 1;

    if (nextSubdivision >= subdivisionCount) {
      bpmPreviewSubdivisionRef.current = 0;
      bpmPreviewBeatRef.current = (currentBeat + 1) % beatsPerBar;
    } else {
      bpmPreviewSubdivisionRef.current = nextSubdivision;
    }

    bpmPreviewTimerRef.current = window.setTimeout(
      scheduleBpmPreviewTick,
      60_000 / latestBpmStateRef.current.bpm / subdivisionCount,
    );
  };

  const toggleBpmPreview = () => {
    if (isBpmPreviewPlaying) {
      if (bpmPreviewTimerRef.current) {
        window.clearTimeout(bpmPreviewTimerRef.current);
        bpmPreviewTimerRef.current = null;
      }
      setIsBpmPreviewPlaying(false);
      return;
    }

    bpmPreviewBeatRef.current = 0;
    bpmPreviewSubdivisionRef.current = 0;
    setIsBpmPreviewPlaying(true);
    scheduleBpmPreviewTick();
  };

  const handleBpmTap = () => {
    const now = performance.now();
    const nextTapTimes = [...tapTimes.filter((time) => now - time <= TAP_RESET_MS), now].slice(-6);
    setTapTimes(nextTapTimes);

    if (nextTapTimes.length < 2) return;

    const intervals = nextTapTimes.slice(1).map((time, index) => time - nextTapTimes[index]);
    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    setBpmDraft(clampSongBpm(60_000 / averageInterval));
  };

  const playBpmPreviewClick = (accent: boolean, subdivisionTick: boolean) => {
    const audioWindow = window as AudioWindow;
    const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;

    if (!AudioContextCtor) return;

    const context = audioContextRef.current ?? new AudioContextCtor();
    audioContextRef.current = context;

    if (context.state === "suspended") {
      void context.resume();
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const style = latestBpmStateRef.current.soundStyle;

    if (style === "wood") {
      oscillator.type = "square";
      oscillator.frequency.value = accent ? 1320 : subdivisionTick ? 660 : 880;
    } else if (style === "soft") {
      oscillator.type = "sine";
      oscillator.frequency.value = accent ? 880 : subdivisionTick ? 440 : 620;
    } else {
      oscillator.type = "triangle";
      oscillator.frequency.value = accent ? 1600 : subdivisionTick ? 700 : 1000;
    }

    const volume = accent ? 0.55 : subdivisionTick ? 0.16 : 0.34;
    const decay = style === "soft" ? 0.09 : 0.045;

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + decay);
  };

  const applyBpmPreset = (preset: BpmPreset) => {
    setBpmDraft(preset.bpm);
    setBpmTimeSignature(preset.timeSignature);
    setBpmAccentFirstBeat(preset.accentFirstBeat);
    setBpmSubdivision(preset.subdivision.toString() as Subdivision);
    setBpmSoundStyle(preset.soundStyle);
    bpmPreviewBeatRef.current = 0;
    bpmPreviewSubdivisionRef.current = 0;
    setPreviewBeat(1);
    setPreviewSubdivision(0);
  };

  const saveSongBpm = async () => {
    if (!bpmSong) return;

    setIsSavingBpm(true);
    setBpmError(null);

    try {
      const response = await fetch(`/api/setlists/${setId}/songs/${bpmSong.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bpm: bpmDraft }),
      });

      if (!response.ok) {
        throw new Error("Failed to update BPM");
      }

      const updatedSong = (await response.json()) as SetlistSong;

      queryClient.setQueryData<SetlistWithSongs>(
        getGetSetlistQueryKey(setId),
        (current) =>
          current
            ? {
                ...current,
                songs: current.songs.map((song) =>
                  song.id === updatedSong.id ? { ...song, bpm: updatedSong.bpm } : song,
                ),
              }
            : current,
      );
      queryClient.invalidateQueries({ queryKey: getGetSetlistQueryKey(setId) });
      closeBpmModal();
    } catch {
      setBpmError("Nao foi possivel salvar o BPM dessa musica.");
    } finally {
      setIsSavingBpm(false);
    }
  };

  const saveCurrentBpmAsPreset = async () => {
    if (!bpmSong) return;

    setIsSavingBpmPreset(true);
    setBpmError(null);

    try {
      const response = await fetch("/api/bpm-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${bpmSong.title} - ${bpmDraft} BPM`,
          bpm: bpmDraft,
          timeSignature: bpmTimeSignature,
          accentFirstBeat: bpmAccentFirstBeat,
          subdivision: Number(bpmSubdivision),
          soundStyle: bpmSoundStyle,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save BPM preset");
      }

      const savedPreset = (await response.json()) as BpmPreset;
      setBpmPresets((current) => [savedPreset, ...current]);
    } catch {
      setBpmError("Nao foi possivel salvar esse BPM como preset.");
    } finally {
      setIsSavingBpmPreset(false);
    }
  };

  const handleDeleteSetlist = () => {
    deleteMutation.mutate(
      { id: setId },
      {
        onSuccess: () => {
          setIsDeleteModalOpen(false);
          queryClient.invalidateQueries({
            queryKey: getListSetlistsQueryKey(),
          });
          router.push("/");
        },
      },
    );
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    // Optimistic local update could go here, but relying on server state for simplicity
    const newSongs = Array.from(setlist.songs);
    const [reordered] = newSongs.splice(sourceIndex, 1);
    newSongs.splice(destinationIndex, 0, reordered);

    const songIds = newSongs.map((s) => s.id);

    reorderMutation.mutate(
      { id: setId, data: { songIds } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetSetlistQueryKey(setId),
          });
        },
      },
    );
  };

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden flex flex-col">
      {/* Background Hero */}
      <div className="absolute top-0 left-0 w-full h-96 z-0 pointer-events-none opacity-30">
        <img
          src="/images/hero-bg.png"
          alt="Concert background"
          className="w-full h-full object-cover object-top mask-image-gradient-b"
          style={{
            maskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, transparent 100%)",
          }}
        />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-7xl min-w-0 flex-1 px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Setlist Header */}
        <div className="mb-8 flex min-w-0 flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="min-w-0">
            <Link
              href="/"
              className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Setlists
            </Link>

            {isEditingName ? (
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-auto w-full min-w-0 max-w-md bg-black/40 py-2 text-3xl font-display font-bold sm:text-5xl"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                />
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="glow"
                    onClick={handleSaveName}
                    disabled={updateMutation.isPending}
                  >
                    <Check className="w-5 h-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setIsEditingName(false)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="group flex min-w-0 items-start gap-2 sm:items-center sm:gap-4">
                <h1 className="min-w-0 break-words text-3xl font-display font-bold tracking-tight text-foreground text-glow sm:text-6xl">
                  {setlist.name}
                </h1>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 rounded-full"
                  onClick={() => {
                    setEditName(setlist.name);
                    setIsEditingName(true);
                  }}
                >
                  <Edit2 className="w-5 h-5 text-muted-foreground active:text-primary" />
                </Button>
              </div>
            )}
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:flex-wrap md:items-center">
            <Button asChild variant="outline" className="w-full gap-2 md:w-auto">
              <Link href="/bpm">
                <Gauge className="w-4 h-4" />
                Modo metronomo
              </Link>
            </Button>
            <Button
              variant="destructive"
              className="w-full gap-2 md:w-auto"
              onClick={() => setIsDeleteModalOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              Delete Setlist
            </Button>
            {setlist.songs.length === 0 ? (
              <Button variant="glow" className="w-full md:w-auto" disabled>
                <Mic2 className="mr-2 h-5 w-5" />
                Apresentar
              </Button>
            ) : (
              <Button asChild variant="glow" className="w-full md:w-auto">
                <Link href={`/setlists/${setId}/presentation`}>
                  <Mic2 className="mr-2 h-5 w-5" />
                  Apresentar
                </Link>
              </Button>
            )}
            <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/5 bg-black/40 px-4 py-3 backdrop-blur-md sm:gap-4 sm:px-6 sm:py-4 md:min-w-64">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 sm:h-12 sm:w-12">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Total Runtime
                </p>
                <p className="text-2xl font-display font-bold text-foreground sm:text-3xl">
                  {formatDuration(
                    setlist.songs.reduce((acc, s) => acc + s.durationMs, 0),
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-6 pb-20 lg:grid-cols-3 lg:gap-8">
          {/* Main Song List Column */}
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-display font-bold flex items-center gap-2">
                Tracks{" "}
                <span className="px-2 py-0.5 rounded-md bg-secondary text-sm">
                  {setlist.songs.length}
                </span>
              </h2>
            </div>

            {setlist.songs.length === 0 ? (
              <div className="glass-panel rounded-2xl p-12 text-center border-dashed border-2 border-white/10">
                <Music className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-bold mb-2">No tracks yet</h3>
                <p className="text-muted-foreground">
                  Search Deezer on the right to add songs to this setlist.
                </p>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="song-list">
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={cn(
                        "min-w-0 space-y-3 rounded-2xl p-0 transition-colors sm:p-2",
                        snapshot.isDraggingOver ? "bg-white/5" : "",
                      )}
                    >
                      {setlist.songs.map((song, index) => (
                        <Draggable
                          key={song.id}
                          draggableId={song.id.toString()}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                "group grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 rounded-xl border p-3 transition-all duration-200 sm:flex sm:gap-4 sm:pr-4",
                                snapshot.isDragging
                                  ? "bg-secondary border-primary/50 shadow-2xl shadow-primary/20 z-50 scale-[1.02]"
                                  : "glass-panel active:bg-white/[0.08]",
                              )}
                              style={provided.draggableProps.style}
                            >
                              <div
                                {...provided.dragHandleProps}
                                className="-ml-2 cursor-grab p-2 text-muted-foreground active:cursor-grabbing active:text-foreground"
                              >
                                <GripVertical className="w-5 h-5" />
                              </div>

                              <div className="hidden w-8 text-center font-mono text-sm font-bold text-muted-foreground sm:block">
                                {(index + 1).toString().padStart(2, "0")}
                              </div>

                              {song.albumArt ? (
                                <img
                                  src={song.albumArt}
                                  alt="Album Art"
                                  className="h-11 w-11 rounded-md object-cover shadow-md sm:h-12 sm:w-12"
                                />
                              ) : (
                                <div className="flex h-11 w-11 items-center justify-center rounded-md border border-white/5 bg-background sm:h-12 sm:w-12">
                                  <Music className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-base text-foreground truncate">
                                  {song.title}
                                </h4>
                                <p className="text-sm text-muted-foreground truncate">
                                  {song.artist}
                                </p>
                                <p className="mt-1 text-xs font-medium text-muted-foreground sm:hidden">
                                  {formatDuration(song.durationMs)} - {song.bpm ? `${song.bpm} BPM` : "-- BPM"}
                                </p>
                              </div>

                              <div className="hidden w-16 text-right font-mono font-medium tracking-tight text-foreground sm:block">
                                {formatDuration(song.durationMs)}
                              </div>
                              <div className="hidden w-16 text-right font-mono text-xs font-semibold text-primary sm:block">
                                {song.bpm ? `${song.bpm} BPM` : "-- BPM"}
                              </div>

                              <div className="col-span-3 grid min-w-0 grid-cols-[1fr_1fr_auto] gap-2 sm:contents">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="min-w-0 px-3 sm:flex-shrink-0"
                                  onClick={() => openBpmModal(song)}
                                >
                                  <Gauge className="mr-2 h-4 w-4" />
                                  BPM
                                </Button>

                                <Button
                                  asChild
                                  variant="outline"
                                  size="sm"
                                  className="min-w-0 px-3 sm:flex-shrink-0"
                                >
                                  <Link
                                    href={`/setlists/${setId}/songs/${song.id}/lyrics`}
                                  >
                                    {pendingLyricsSongIds.has(song.id) ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <FileText className="mr-2 h-4 w-4" />
                                    )}
                                    {pendingLyricsSongIds.has(song.id)
                                      ? "Lyrics..."
                                      : "Lyrics"}
                                  </Link>
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 shrink-0 rounded-full bg-destructive/10 text-destructive transition-all active:bg-destructive/30 sm:ml-2 sm:h-10 sm:w-10"
                                  onClick={() => handleRemoveSong(song.id)}
                                  disabled={removeSongMutation.isPending}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>

          {/* Deezer Search Sidebar */}
          <div className="min-w-0 lg:sticky lg:top-28 lg:col-span-1 lg:h-[calc(100vh-250px)]">
            <DeezerSearch
              onAddTrack={handleAddTrack}
              isAdding={addSongMutation.isPending}
            />
          </div>
        </div>
      </main>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Setlist"
      >
        <div className="space-y-6">
          <p className="text-muted-foreground text-lg">
            Are you sure you want to delete this setlist? This action cannot be
            undone.
          </p>
          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
            <Button className="w-full sm:w-auto" variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleDeleteSetlist}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={bpmSong !== null}
        onClose={closeBpmModal}
        title="Configurar BPM da musica"
        className="lg:max-w-5xl"
      >
        <div className="max-h-[calc(100dvh-6.5rem)] space-y-4 overflow-y-auto overflow-x-hidden sm:max-h-[78vh] sm:space-y-6 sm:pr-1">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Musica</p>
            <h3 className="mt-1 break-words text-xl font-display font-bold sm:text-2xl">
              {bpmSong?.title}
            </h3>
            <p className="break-words text-sm text-muted-foreground sm:text-base">{bpmSong?.artist}</p>
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[0.9fr_1.1fr] xl:gap-6">
            <div className="flex min-w-0 flex-col items-center justify-center rounded-2xl border border-white/5 bg-background/40 p-3 sm:p-6">
              <div className="text-sm font-medium uppercase tracking-[0.25em] text-muted-foreground">
                BPM
              </div>
              <div className="mt-3 font-display text-6xl font-bold leading-none text-glow sm:mt-4 sm:text-8xl">
                {bpmDraft}
              </div>
              <div className="mt-5 grid w-full max-w-sm grid-cols-3 gap-2">
                <Button type="button" variant="secondary" className="min-w-0 px-2" onClick={() => setBpmDraft((value) => clampSongBpm(value - 1))}>
                  -1
                </Button>
                <Button type="button" variant="outline" className="min-w-0 px-2" onClick={handleBpmTap}>
                  Tap
                </Button>
                <Button type="button" variant="secondary" className="min-w-0 px-2" onClick={() => setBpmDraft((value) => clampSongBpm(value + 1))}>
                  +1
                </Button>
              </div>
              <Button
                type="button"
                variant={isBpmPreviewPlaying ? "secondary" : "glow"}
                size="lg"
                onClick={toggleBpmPreview}
                className="mt-5 w-full max-w-sm min-w-0 px-4 text-base"
              >
                {isBpmPreviewPlaying ? (
                  <Pause className="mr-2 h-5 w-5" />
                ) : (
                  <Play className="mr-2 h-5 w-5" />
                )}
                {isBpmPreviewPlaying ? "Pause" : "Play"}
              </Button>
            </div>

            <div className="min-w-0 space-y-6">
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <label className="text-sm font-medium text-muted-foreground">BPM ajustavel</label>
                  <Input
                    type="number"
                    min={MIN_SONG_BPM}
                    max={MAX_SONG_BPM}
                    value={bpmDraft}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isFinite(value)) {
                        setBpmDraft(clampSongBpm(value));
                      }
                    }}
                    className="h-10 w-full text-center sm:w-24"
                  />
                </div>
                <Slider
                  min={MIN_SONG_BPM}
                  max={MAX_SONG_BPM}
                  step={1}
                  value={[bpmDraft]}
                  onValueChange={([value]) => setBpmDraft(value)}
                />
              </div>

              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <label className="min-w-0 space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Compasso</span>
                  <Select value={bpmTimeSignature} onValueChange={(value) => setBpmTimeSignature(value as TimeSignature)}>
                    <SelectTrigger className="h-12 rounded-xl border-2 bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSignatureOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="min-w-0 space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Som</span>
                  <Select value={bpmSoundStyle} onValueChange={(value) => setBpmSoundStyle(value as SoundStyle)}>
                    <SelectTrigger className="h-12 rounded-xl border-2 bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {soundOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="min-w-0 space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Subdivisao simples</span>
                  <Select value={bpmSubdivision} onValueChange={(value) => setBpmSubdivision(value as Subdivision)}>
                    <SelectTrigger className="h-12 rounded-xl border-2 bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {subdivisionOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <div className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-white/5 bg-background/40 p-3 sm:p-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Acento no primeiro tempo</div>
                    <div className="text-xs text-muted-foreground">Realca o tempo 1.</div>
                  </div>
                  <Switch checked={bpmAccentFirstBeat} onCheckedChange={setBpmAccentFirstBeat} />
                </div>
              </div>

              <div className="min-w-0 rounded-2xl border border-white/5 bg-background/40 p-3 sm:p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Volume2 className="h-4 w-4 text-primary" />
                    Pulso atual
                  </div>
                  <span className="text-sm text-muted-foreground">{bpmTimeSignature}</span>
                </div>
                <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${getBeatCount(bpmTimeSignature)}, minmax(0, 1fr))` }}>
                  {Array.from({ length: getBeatCount(bpmTimeSignature) }, (_, index) => index + 1).map((beat) => (
                    <div
                      key={beat}
                      className={cn(
                        "flex aspect-square min-w-0 items-center justify-center rounded-xl border text-xl font-bold transition-all sm:rounded-2xl sm:text-2xl",
                        previewBeat === beat && isBpmPreviewPlaying
                          ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "border-white/10 bg-secondary/50 text-muted-foreground",
                        beat === 1 && bpmAccentFirstBeat && "ring-1 ring-primary/30",
                      )}
                    >
                      {beat}
                    </div>
                  ))}
                </div>
                {Number(bpmSubdivision) > 1 ? (
                  <div className="mt-4 flex justify-center gap-2">
                    {Array.from({ length: Number(bpmSubdivision) }, (_, index) => (
                      <span
                        key={index}
                        className={cn(
                          "h-2 w-full max-w-8 rounded-full bg-muted transition-colors",
                          previewSubdivision === index && isBpmPreviewPlaying && "bg-primary",
                        )}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-3 rounded-2xl border border-white/5 bg-background/40 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Presets salvos</p>
                <p className="text-xs text-muted-foreground">
                  Aplique um preset no BPM desta musica.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={saveCurrentBpmAsPreset}
                disabled={isSavingBpmPreset}
                className="w-full sm:w-auto"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSavingBpmPreset ? "Salvando..." : "Salvar preset"}
              </Button>
            </div>

            {isLoadingBpmPresets ? (
              <p className="rounded-xl border border-white/5 p-3 text-center text-sm text-muted-foreground">
                Carregando presets...
              </p>
            ) : bpmPresets.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 p-3 text-center text-sm text-muted-foreground">
                Nenhum preset salvo. Crie no modo metronomo ou salve este BPM.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {bpmPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyBpmPreset(preset)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      bpmDraft === preset.bpm &&
                        bpmTimeSignature === preset.timeSignature &&
                        bpmSubdivision === preset.subdivision.toString() &&
                        bpmSoundStyle === preset.soundStyle &&
                        bpmAccentFirstBeat === preset.accentFirstBeat
                        ? "border-primary bg-primary/10"
                        : "border-white/10 bg-secondary/30 hover:border-primary/40",
                    )}
                  >
                    <span className="block truncate text-sm font-semibold">
                      {preset.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {preset.bpm} BPM - {preset.timeSignature}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {bpmError ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {bpmError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={closeBpmModal}>
              Cancelar
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={saveSongBpm} disabled={isSavingBpm}>
              <Save className="mr-2 h-4 w-4" />
              {isSavingBpm ? "Salvando..." : "Salvar na musica"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
