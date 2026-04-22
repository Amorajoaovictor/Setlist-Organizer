import React, { useState } from "react";
import { Link } from "wouter";
import { Plus, ListMusic, Calendar, Clock, Trash2, ChevronRight, Music } from "lucide-react";
import { useListSetlists, useCreateSetlist, useDeleteSetlist, getListSetlistsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { formatDuration } from "@/lib/utils";

export default function Setlists() {
  const queryClient = useQueryClient();
  const { data: setlists, isLoading } = useListSetlists();
  const createMutation = useCreateSetlist();
  const deleteMutation = useDeleteSetlist();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSetName, setNewSetName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSetName.trim()) return;
    
    createMutation.mutate(
      { data: { name: newSetName } },
      {
        onSuccess: () => {
          setIsCreateModalOpen(false);
          setNewSetName("");
          queryClient.invalidateQueries({ queryKey: getListSetlistsQueryKey() });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          setDeleteConfirmId(null);
          queryClient.invalidateQueries({ queryKey: getListSetlistsQueryKey() });
        }
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 relative">
        {/* Background Image Layer */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
            alt="Concert background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-12">
            <div>
              <h1 className="text-4xl sm:text-5xl font-display font-bold text-foreground tracking-tight mb-2">
                Your Setlists
              </h1>
              <p className="text-muted-foreground text-lg">Manage your shows, rehearsals, and concepts.</p>
            </div>
            <Button 
              variant="glow" 
              size="lg" 
              onClick={() => setIsCreateModalOpen(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Setlist
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 rounded-2xl glass-panel animate-pulse bg-white/5" />
              ))}
            </div>
          ) : setlists?.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center max-w-2xl mx-auto mt-20 border-dashed border-2 border-white/10">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <ListMusic className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-display font-bold mb-4">No setlists yet</h2>
              <p className="text-muted-foreground mb-8 text-lg">
                Create your first setlist to start organizing your tracks and calculating set durations.
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)} size="lg">
                Create Setlist
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {setlists?.map(setlist => (
                <div key={setlist.id} className="group relative">
                  <Link 
                    href={`/setlists/${setlist.id}`}
                    className="block h-full glass-panel rounded-2xl p-6 transition-all duration-300 active:-translate-y-1 active:border-primary/30 active:shadow-[0_10px_40px_-10px_rgba(0,229,255,0.15)]"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-background border border-white/10 flex items-center justify-center shadow-inner group-active:from-primary/20 group-active:to-background group-active:text-primary transition-all">
                        <Music className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground group-active:text-primary transition-colors">
                        <span className="text-sm font-medium">View</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                    
                    <h3 className="text-2xl font-display font-bold text-foreground mb-2 truncate">
                      {setlist.name}
                    </h3>
                    
                    <div className="space-y-3 mt-6 pt-6 border-t border-white/5">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 mr-3 text-primary/70" />
                        <span>{formatDuration(setlist.totalDurationMs)} total runtime</span>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <ListMusic className="w-4 h-4 mr-3 text-primary/70" />
                        <span>{setlist.songCount} {setlist.songCount === 1 ? 'song' : 'songs'}</span>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 mr-3 text-primary/70" />
                        <span>Created {format(new Date(setlist.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </Link>
                  
                  <div className="absolute top-4 right-4 z-20">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="bg-destructive/10 text-destructive active:bg-destructive/30 h-8 w-8 rounded-full"
                      onClick={(e) => {
                        e.preventDefault();
                        setDeleteConfirmId(setlist.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Setlist"
      >
        <form onSubmit={handleCreate} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Setlist Name</label>
            <Input
              autoFocus
              placeholder="e.g., Summer Tour 2025, Rehearsal A..."
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              className="text-lg"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !newSetName.trim()}>
              {createMutation.isPending ? "Creating..." : "Create Setlist"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Setlist"
      >
        <div className="space-y-6">
          <p className="text-muted-foreground text-lg">
            Are you sure you want to delete this setlist? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
