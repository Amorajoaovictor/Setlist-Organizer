"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Clock, Loader2, Music } from "lucide-react";
import { useGetSetlist } from "@workspace/api-client-react";

import { Button } from "@/components/Button";
import { LyricsSyncPanel } from "@/components/LyricsSyncPanel";
import { formatDuration } from "@/lib/utils";

export default function LyricsSyncEditor() {
  const params = useParams<{ id: string; songId: string }>();
  const rawSetlistId = params?.id;
  const rawSongId = params?.songId;
  const setlistId = Number.parseInt(
    Array.isArray(rawSetlistId) ? rawSetlistId[0] : rawSetlistId || "0",
    10,
  );
  const songId = Number.parseInt(
    Array.isArray(rawSongId) ? rawSongId[0] : rawSongId || "0",
    10,
  );

  const { data: setlist, isLoading, isError } = useGetSetlist(setlistId);
  const song = setlist?.songs.find((item) => item.id === songId) ?? null;

  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50" />
      </main>
    );
  }

  if (isError || !setlist || !song) {
    return (
      <main className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-4 px-4 text-destructive">
        <AlertCircle className="h-16 w-16" />
        <h1 className="text-2xl font-bold">Musica nao encontrada</h1>
        <Link href={setlistId ? `/setlists/${setlistId}` : "/"}>
          <Button variant="outline">Voltar para setlist</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="relative min-h-[calc(100vh-5rem)] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.22),transparent_55%)]" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Link
              href={`/setlists/${setlistId}`}
              className="mb-5 inline-flex items-center text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para {setlist.name}
            </Link>
            <div className="flex min-w-0 items-center gap-4">
              {song.albumArt ? (
                <img
                  src={song.albumArt}
                  alt=""
                  className="h-16 w-16 flex-shrink-0 rounded-xl object-cover shadow-xl shadow-black/40"
                />
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <Music className="h-7 w-7 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                  Tela de sincronizacao
                </p>
                <h1 className="truncate font-display text-3xl font-bold text-white sm:text-5xl">
                  {song.title}
                </h1>
                <p className="truncate text-sm text-muted-foreground">{song.artist}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/35 px-5 py-4 backdrop-blur-xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Duracao
              </p>
              <p className="font-display text-2xl font-bold text-white">
                {formatDuration(song.durationMs)}
              </p>
            </div>
          </div>
        </div>

        <LyricsSyncPanel setlistId={setlistId} song={song} />
      </div>
    </main>
  );
}
