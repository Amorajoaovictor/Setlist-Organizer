import React, { useEffect, useState } from "react";
import { AlertCircle, Loader2, Music, Plus, Search } from "lucide-react";
import {
  getSearchDeezerTracksQueryKey,
  useSearchDeezerTracks,
  type DeezerTrack,
} from "@workspace/api-client-react";
import { Input } from "./Input";
import { Button } from "./Button";
import { formatDuration } from "@/lib/utils";

interface DeezerSearchProps {
  onAddTrack: (track: DeezerTrack) => void;
  isAdding: boolean;
}

export function DeezerSearch({ onAddTrack, isAdding }: DeezerSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: tracks, isLoading, isError } = useSearchDeezerTracks(
    { q: debouncedQuery },
    {
      query: {
        queryKey: getSearchDeezerTracksQueryKey({ q: debouncedQuery }),
        enabled: debouncedQuery.length > 2,
        staleTime: 1000 * 60 * 5,
      },
    },
  );

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl glass-panel">
      <div className="p-4 sm:p-6 border-b border-white/5 bg-background/40">
        <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          Find Songs
        </h3>
        <div className="relative">
          <Input
            placeholder="Search Deezer..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-10 bg-black/50 border-white/10 focus-visible:border-primary/50"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 sm:p-4">
        {isLoading && debouncedQuery.length > 2 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p>Searching Deezer catalog...</p>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-12 text-destructive">
            <AlertCircle className="w-8 h-8 mb-4" />
            <p>Failed to connect to Deezer.</p>
          </div>
        )}

        {!isLoading && debouncedQuery.length <= 2 && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 border border-white/5">
              <Music className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              Type at least 3 characters to search the Deezer catalog.
            </p>
          </div>
        )}

        {!isLoading &&
          tracks &&
          tracks.length === 0 &&
          debouncedQuery.length > 2 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="w-8 h-8 mb-4 opacity-20" />
              <p>No tracks found for "{debouncedQuery}"</p>
            </div>
          )}

        <div className="space-y-2">
          {tracks?.map((track) => (
            <div
              key={track.id}
              className="group flex min-w-0 items-center gap-3 rounded-xl border border-transparent p-2 transition-colors active:border-white/5 active:bg-white/5"
            >
              {track.albumArt ? (
                <img
                  src={track.albumArt}
                  alt={track.title}
                  className="w-12 h-12 rounded-md object-cover shadow-md"
                />
              ) : (
                <div className="w-12 h-12 rounded-md bg-secondary flex items-center justify-center">
                  <Music className="w-5 h-5 text-muted-foreground" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate group-active:text-primary transition-colors">
                  {track.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {track.artist}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3 pl-1 sm:pl-2">
                <div className="hidden text-right font-mono text-xs text-muted-foreground sm:block">
                  <p>{formatDuration(track.durationMs)}</p>
                  <p className="text-primary/80">
                    {track.bpm ? `${track.bpm} BPM` : "-- BPM"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 rounded-full bg-primary/20 text-primary active:bg-primary active:text-primary-foreground transition-all"
                  onClick={() => onAddTrack(track)}
                  disabled={isAdding}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
