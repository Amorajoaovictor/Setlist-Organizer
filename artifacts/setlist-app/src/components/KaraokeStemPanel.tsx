"use client";

import { useMemo, useState } from "react";
import {
  AudioLines,
  CheckCircle2,
  Download,
  Loader2,
  RadioTower,
  ShieldCheck,
} from "lucide-react";
import { useGetSpleeterStatus } from "@workspace/api-client-react";

import { Button } from "@/components/Button";
import { cn } from "@/lib/utils";

type StemResult = {
  name: string;
  url: string;
  playable: boolean;
};

type StemName = "vocals" | "drums" | "bass" | "guitar" | "other";
type SeparationStatus = "queued" | "processing" | "done" | "failed" | "expired";
type SeparationJob = {
  job_id: string;
  status: SeparationStatus;
  created_at?: string;
  updated_at?: string;
  expires_at?: string;
  error: string | null;
};

const POLLING_INTERVAL_MS = 3_000;
const SEPARATION_TIMEOUT_MS = 30 * 60 * 1_000;
const FINAL_STEMS: StemName[] = ["vocals", "drums", "bass", "guitar", "other"];

export function KaraokeStemPanel({
  audioFile,
  hasPreviewSource,
  hasLocalAudio,
}: {
  audioFile: File | null;
  hasPreviewSource: boolean;
  hasLocalAudio: boolean;
}) {
  const { data: status, isLoading } = useGetSpleeterStatus();
  const [isSeparating, setIsSeparating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [jobMessage, setJobMessage] = useState("");
  const [stems, setStems] = useState<StemResult[]>([]);
  const isConfigured = Boolean(status?.configured);
  const canPrepare = isConfigured && hasLocalAudio;
  const supportedStems = useMemo(
    () => (status?.supportedStems ?? FINAL_STEMS) as StemName[],
    [status?.supportedStems],
  );

  async function prepareStems() {
    if (!audioFile || !status?.serviceUrl) {
      return;
    }

    setIsSeparating(true);
    setErrorMessage("");
    setJobMessage("Enviando audio para separacao");
    setStems([]);

    try {
      const formData = new FormData();
      formData.append(status.fileFieldName || "file", audioFile, audioFile.name);

      const headers: HeadersInit = {};
      const publicApiKey = process.env.NEXT_PUBLIC_MUSIC_SEPARATOR_API_KEY?.trim();
      if (publicApiKey) {
        headers.Authorization = `Bearer ${publicApiKey}`;
      }

      const uploadUrl = `${status.serviceUrl}/separations`;
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await readSeparatorError(response, "criar separacao"));
      }

      const created = (await response.json()) as { job_id?: string; status?: string };
      if (!created.job_id) {
        throw new Error("Music Separator API nao retornou job_id.");
      }

      setJobMessage(formatJobStatus(created.status, created.job_id));
      const finished = await waitForSeparation(status.serviceUrl, created.job_id, headers);
      setJobMessage(formatJobStatus(finished.status, finished.job_id));
      const nextStems = await downloadFinishedStems(
        status.serviceUrl,
        finished.job_id,
        supportedStems,
        headers,
      );
      setStems(nextStems);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel separar o audio agora.",
      );
      setJobMessage("");
    } finally {
      setIsSeparating(false);
    }
  }

  return (
    <div className="rounded-xl border border-fuchsia-300/15 bg-fuchsia-300/[0.04] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <AudioLines className="h-4 w-4 text-fuchsia-300" />
            Karaoke stems
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Separacao via sua Music Separator API com Spleeter em servico externo.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            isConfigured
              ? "bg-emerald-400/10 text-emerald-200"
              : "bg-slate-700/60 text-slate-300",
          )}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isConfigured ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <RadioTower className="h-3 w-3" />
          )}
          {isLoading ? "Checando" : isConfigured ? "Configurado" : "Pendente"}
        </span>
      </div>

      <div className="grid gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" />
          Audio direto do navegador para sua API local; o backend nao armazena arquivos.
        </div>
        <div>
          Stems: {supportedStems.join(", ")}
        </div>
        {status?.serviceUrl ? (
          <div className="truncate font-mono text-[0.7rem] text-slate-500">
            {status.serviceUrl}
          </div>
        ) : null}
      </div>

      <Button
        variant="outline"
        disabled={!canPrepare || isSeparating}
        onClick={prepareStems}
        className="mt-3 w-full border-fuchsia-300/20 text-fuchsia-100"
        title={
          isConfigured
            ? hasLocalAudio
              ? "Enviar audio local direto para a Music Separator API."
              : "Selecione um arquivo local para preparar stems."
            : "Configure NEXT_PUBLIC_MUSIC_SEPARATOR_API_URL para conectar sua API."
        }
      >
        {isSeparating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <AudioLines className="mr-2 h-4 w-4" />
        )}
        {isSeparating ? "Separando stems" : "Preparar stems locais"}
      </Button>

      {jobMessage ? (
        <p className="mt-2 rounded-lg border border-cyan-300/15 bg-cyan-300/10 p-2 text-xs text-cyan-100">
          {jobMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-2 rounded-lg border border-red-400/20 bg-red-500/10 p-2 text-xs text-red-200">
          {errorMessage}
        </p>
      ) : null}

      {stems.length > 0 ? (
        <div className="mt-3 space-y-2">
          {stems.map((stem) => (
            <div
              key={`${stem.name}-${stem.url}`}
              className="rounded-lg border border-white/10 bg-black/25 p-2"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs font-semibold text-slate-200">
                  {stem.name}
                </span>
                <a
                  href={stem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-cyan-200 hover:text-cyan-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  Abrir
                </a>
              </div>
              {stem.playable ? <audio src={stem.url} controls className="w-full" /> : null}
            </div>
          ))}
        </div>
      ) : null}

      {!hasPreviewSource ? (
        <p className="mt-2 text-xs text-slate-500">
          Selecione um audio local para futura separacao de stems.
        </p>
      ) : null}
    </div>
  );
}

async function waitForSeparation(
  apiBaseUrl: string,
  jobId: string,
  headers: HeadersInit,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < SEPARATION_TIMEOUT_MS) {
    const response = await fetch(`${apiBaseUrl}/separations/${jobId}`, {
      headers,
    });
    if (!response.ok) {
      throw new Error(await readSeparatorError(response, "consultar status"));
    }

    const job = (await response.json()) as SeparationJob;
    if (job.status === "done") {
      return job;
    }

    if (job.status === "failed" || job.status === "expired") {
      throw new Error(job.error ?? `Separacao terminou com status: ${job.status}`);
    }

    await delay(POLLING_INTERVAL_MS);
  }

  throw new Error("Separacao demorou demais e foi interrompida.");
}

async function downloadFinishedStems(
  apiBaseUrl: string,
  jobId: string,
  stemNames: StemName[],
  headers: HeadersInit,
) {
  const stems = await Promise.all(
    stemNames.map(async (stem) => {
      const response = await fetch(
        `${apiBaseUrl}/separations/${jobId}/download/${stem}`,
        { headers },
      );

      if (!response.ok) {
        throw new Error(await readSeparatorError(response, `baixar stem ${stem}`));
      }

      const blob = await response.blob();
      return {
        name: stem,
        url: URL.createObjectURL(blob),
        playable: blob.type.startsWith("audio/") || blob.type === "",
      };
    }),
  );

  return stems;
}

async function readSeparatorError(response: Response, action: string) {
  const fallback = `Falha ao ${action}: Music Separator API retornou ${response.status}.`;

  try {
    const payload = (await response.json()) as { detail?: unknown; error?: unknown };
    const message = payload.error ?? payload.detail;
    return typeof message === "string" ? message : fallback;
  } catch {
    return fallback;
  }
}

function formatJobStatus(status: string | undefined, jobId: string) {
  const labels: Record<string, string> = {
    queued: "Na fila",
    processing: "Separando stems",
    done: "Stems prontos",
    failed: "Falhou",
    expired: "Expirado",
  };

  return `${labels[status ?? ""] ?? "Processando"} (${jobId})`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
