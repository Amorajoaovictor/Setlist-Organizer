"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/Button";
import { SetlistPresentationMode } from "@/components/SetlistPresentationMode";
import { useGetSetlist } from "@workspace/api-client-react";

export default function SetlistPresentationPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const setId = parseInt(id || "0", 10);

  const { data: setlist, isLoading, isError } = useGetSetlist(setId);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020407] text-white">
        <Loader2 className="h-12 w-12 animate-spin text-cyan-200 opacity-70" />
      </div>
    );
  }

  if (isError || !setlist) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#020407] px-6 text-center text-white">
        <AlertCircle className="h-16 w-16 text-destructive" />
        <h1 className="font-display text-3xl font-bold">
          Setlist nao encontrada
        </h1>
        <Button asChild variant="outline">
          <Link href="/">Voltar para setlists</Link>
        </Button>
      </div>
    );
  }

  return (
    <SetlistPresentationMode
      setlistId={setId}
      setlistName={setlist.name}
      songs={setlist.songs}
    />
  );
}
