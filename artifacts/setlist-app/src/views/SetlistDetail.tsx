import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { 
  ArrowLeft, Clock, GripVertical, Trash2, Edit2, 
  Check, X, Music, AlertCircle, Loader2, FileText
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetSetlist, 
  useUpdateSetlist, 
  useAddSongToSetlist, 
  useRemoveSongFromSetlist, 
  useReorderSetlistSongs,
  getGetSetlistQueryKey,
  getListSetlistsQueryKey
} from "@workspace/api-client-react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { SpotifySearch } from "@/components/SpotifySearch";
import { SetlistPresentationMode } from "@/components/SetlistPresentationMode";
import { formatDuration, cn } from "@/lib/utils";

export default function SetlistDetail() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const setId = parseInt(id || "0", 10);
  const queryClient = useQueryClient();

  const { data: setlist, isLoading, isError } = useGetSetlist(setId);
  
  const updateMutation = useUpdateSetlist();
  const addSongMutation = useAddSongToSetlist();
  const removeSongMutation = useRemoveSongFromSetlist();
  const reorderMutation = useReorderSetlistSongs();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");

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
          queryClient.invalidateQueries({ queryKey: getGetSetlistQueryKey(setId) });
          queryClient.invalidateQueries({ queryKey: getListSetlistsQueryKey() });
        }
      }
    );
  };

  const handleAddTrack = (track: any) => {
    addSongMutation.mutate(
      { 
        id: setId, 
        data: { 
          title: track.title, 
          artist: track.artist, 
          durationMs: track.durationMs, 
          spotifyId: track.id, 
          albumArt: track.albumArt 
        } 
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSetlistQueryKey(setId) });
          queryClient.invalidateQueries({ queryKey: getListSetlistsQueryKey() });
        }
      }
    );
  };

  const handleRemoveSong = (songId: number) => {
    removeSongMutation.mutate(
      { id: setId, songId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSetlistQueryKey(setId) });
          queryClient.invalidateQueries({ queryKey: getListSetlistsQueryKey() });
        }
      }
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
    
    const songIds = newSongs.map(s => s.id);

    reorderMutation.mutate(
      { id: setId, data: { songIds } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSetlistQueryKey(setId) });
        }
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background Hero */}
      <div className="absolute top-0 left-0 w-full h-96 z-0 pointer-events-none opacity-30">
        <img 
          src="/images/hero-bg.png"
          alt="Concert background" 
          className="w-full h-full object-cover object-top mask-image-gradient-b"
          style={{ maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)' }}
        />
      </div>

      <main className="flex-1 relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Setlist Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <Link href="/" className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Setlists
            </Link>
            
            {isEditingName ? (
              <div className="flex items-center gap-3">
                <Input 
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-3xl sm:text-5xl font-display font-bold h-auto py-2 w-full max-w-md bg-black/40"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                />
                <Button size="icon" variant="glow" onClick={handleSaveName} disabled={updateMutation.isPending}>
                  <Check className="w-5 h-5" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => setIsEditingName(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-4 group">
                <h1 className="text-4xl sm:text-6xl font-display font-bold text-foreground tracking-tight text-glow">
                  {setlist.name}
                </h1>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="rounded-full"
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

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <SetlistPresentationMode
              setlistId={setId}
              setlistName={setlist.name}
              songs={setlist.songs}
            />
            <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/5">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Runtime</p>
                <p className="text-3xl font-display font-bold text-foreground">
                  {formatDuration(setlist.songs.reduce((acc, s) => acc + s.durationMs, 0))}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
          
          {/* Main Song List Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-display font-bold flex items-center gap-2">
                Tracks <span className="px-2 py-0.5 rounded-md bg-secondary text-sm">{setlist.songs.length}</span>
              </h2>
            </div>

            {setlist.songs.length === 0 ? (
              <div className="glass-panel rounded-2xl p-12 text-center border-dashed border-2 border-white/10">
                <Music className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-bold mb-2">No tracks yet</h3>
                <p className="text-muted-foreground">Search Spotify on the right to add songs to this setlist.</p>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="song-list">
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={cn(
                        "space-y-3 p-2 rounded-2xl transition-colors",
                        snapshot.isDraggingOver ? "bg-white/5" : ""
                      )}
                    >
                      {setlist.songs.map((song, index) => (
                        <Draggable key={song.id} draggableId={song.id.toString()} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                "flex items-center gap-4 p-3 pr-4 rounded-xl transition-all duration-200 group border",
                                snapshot.isDragging 
                                  ? "bg-secondary border-primary/50 shadow-2xl shadow-primary/20 z-50 scale-[1.02]" 
                                  : "glass-panel active:bg-white/[0.08]"
                              )}
                              style={provided.draggableProps.style}
                            >
                              <div 
                                {...provided.dragHandleProps}
                                className="p-2 -ml-2 text-muted-foreground active:text-foreground cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="w-5 h-5" />
                              </div>
                              
                              <div className="w-8 text-center font-mono text-sm font-bold text-muted-foreground">
                                {(index + 1).toString().padStart(2, '0')}
                              </div>

                              {song.albumArt ? (
                                <img src={song.albumArt} alt="Album Art" className="w-12 h-12 rounded-md object-cover shadow-md" />
                              ) : (
                                <div className="w-12 h-12 rounded-md bg-background flex items-center justify-center border border-white/5">
                                  <Music className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-base text-foreground truncate">{song.title}</h4>
                                <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                              </div>

                              <div className="text-right font-mono font-medium text-foreground tracking-tight w-16">
                                {formatDuration(song.durationMs)}
                              </div>

                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="flex-shrink-0"
                              >
                                <Link href={`/setlists/${setId}/songs/${song.id}/lyrics`}>
                                  <FileText className="w-4 h-4 mr-2" />
                                  Lyrics
                                </Link>
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="bg-destructive/10 text-destructive active:bg-destructive/30 transition-all rounded-full h-10 w-10 ml-2 flex-shrink-0"
                                onClick={() => handleRemoveSong(song.id)}
                                disabled={removeSongMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
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

          {/* Spotify Search Sidebar */}
          <div className="lg:col-span-1 h-[600px] lg:h-[calc(100vh-250px)] lg:sticky lg:top-28">
            <SpotifySearch 
              onAddTrack={handleAddTrack} 
              isAdding={addSongMutation.isPending} 
            />
          </div>

        </div>
      </main>
    </div>
  );
}
