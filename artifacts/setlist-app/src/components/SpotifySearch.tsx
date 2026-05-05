import React, { useState, useEffect } from "react";
import { Search, Plus, Music, Loader2, AlertCircle } from "lucide-react";
import {
  getSearchSpotifyTracksQueryKey,
  useSearchSpotifyTracks,
} from "@workspace/api-client-react";
import { Input } from "./Input";
import { Button } from "./Button";
import { formatDuration } from "@/lib/utils";

interface SpotifySearchProps {
  onAddTrack: (track: any) => void;
  isAdding: boolean;
}

export function SpotifySearch({ onAddTrack, isAdding }: SpotifySearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: tracks, isLoading, isError } = useSearchSpotifyTracks(
    { q: debouncedQuery },
    {
      query: {
        queryKey: getSearchSpotifyTracksQueryKey({ q: debouncedQuery }),
        enabled: debouncedQuery.length > 2,
        staleTime: 1000 * 60 * 5, // 5 mins
      }
    }
  );

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-white/5 bg-background/40">
        <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          Find Songs
        </h3>
        <div className="relative">
          <Input
            placeholder="Search Spotify..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 bg-black/50 border-white/10 focus-visible:border-primary/50"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 sm:p-4">
        {isLoading && debouncedQuery.length > 2 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p>Searching Spotify universe...</p>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-12 text-destructive">
            <AlertCircle className="w-8 h-8 mb-4" />
            <p>Failed to connect to Spotify. Check credentials.</p>
          </div>
        )}

        {!isLoading && debouncedQuery.length <= 2 && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 border border-white/5">
              <Music className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Type at least 3 characters to search the Spotify catalog.</p>
          </div>
        )}

        {!isLoading && tracks && tracks.length === 0 && debouncedQuery.length > 2 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="w-8 h-8 mb-4 opacity-20" />
            <p>No tracks found for "{debouncedQuery}"</p>
          </div>
        )}

        <div className="space-y-2">
          {tracks?.map((track) => (
            <div 
              key={track.id} 
              className="flex items-center gap-3 p-2 rounded-xl active:bg-white/5 transition-colors group border border-transparent active:border-white/5"
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
              
              <div className="flex items-center gap-3 pl-2">
                <span className="text-xs font-mono text-muted-foreground hidden sm:inline-block">
                  {formatDuration(track.durationMs)}
                </span>
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
