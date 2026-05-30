"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Gauge,
  ListPlus,
  Pause,
  Play,
  RotateCcw,
  Save,
  Trash2,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type TimeSignature = "2/4" | "3/4" | "4/4" | "6/8";
type SoundStyle = "classic" | "wood" | "soft";
type Subdivision = "1" | "2" | "4";
type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type Preset = {
  id: number;
  name: string;
  bpm: number;
  timeSignature: TimeSignature;
  accentFirstBeat: boolean;
  subdivision: Subdivision;
  soundStyle: SoundStyle;
  createdAt: string;
  updatedAt: string;
};

type ApiPreset = Omit<Preset, "subdivision"> & {
  subdivision: 1 | 2 | 4;
};

const TAP_RESET_MS = 2200;
const MIN_BPM = 40;
const MAX_BPM = 240;

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

function clampBpm(value: number) {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)));
}

function getBeatCount(signature: TimeSignature) {
  return timeSignatureOptions.find((option) => option.value === signature)?.beats ?? 4;
}

function getPresetPayload(
  name: string,
  bpm: number,
  timeSignature: TimeSignature,
  accentFirstBeat: boolean,
  subdivision: Subdivision,
  soundStyle: SoundStyle
): Omit<ApiPreset, "id" | "createdAt" | "updatedAt"> {
  return {
    name: name.trim(),
    bpm,
    timeSignature,
    accentFirstBeat,
    subdivision: Number(subdivision) as ApiPreset["subdivision"],
    soundStyle,
  };
}

function mapApiPreset(preset: ApiPreset): Preset {
  return {
    ...preset,
    subdivision: preset.subdivision.toString() as Subdivision,
  };
}

export default function BpmMetronome() {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>("4/4");
  const [accentFirstBeat, setAccentFirstBeat] = useState(true);
  const [subdivision, setSubdivision] = useState<Subdivision>("1");
  const [soundStyle, setSoundStyle] = useState<SoundStyle>("classic");
  const [activeBeat, setActiveBeat] = useState(0);
  const [activeSubdivision, setActiveSubdivision] = useState(0);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("Ensaio");
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [trainingEnabled, setTrainingEnabled] = useState(false);
  const [trainingTargetBpm, setTrainingTargetBpm] = useState(150);
  const [trainingStepBpm, setTrainingStepBpm] = useState(2);
  const [trainingEveryBars, setTrainingEveryBars] = useState(4);
  const [trainingBarsDone, setTrainingBarsDone] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const beatIndexRef = useRef(0);
  const subdivisionIndexRef = useRef(0);
  const barCountRef = useRef(0);
  const latestStateRef = useRef({
    bpm,
    timeSignature,
    accentFirstBeat,
    subdivision,
    soundStyle,
    trainingEnabled,
    trainingTargetBpm,
    trainingStepBpm,
    trainingEveryBars,
  });

  const beatsPerBar = useMemo(() => getBeatCount(timeSignature), [timeSignature]);
  const subdivisionCount = Number(subdivision);
  const beatLabels = useMemo(
    () => Array.from({ length: beatsPerBar }, (_, index) => index + 1),
    [beatsPerBar]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPresets() {
      setIsLoadingPresets(true);
      setPresetError(null);

      try {
        const response = await fetch("/api/bpm-presets");

        if (!response.ok) {
          throw new Error("Failed to load presets");
        }

        const payload = (await response.json()) as ApiPreset[];

        if (!cancelled) {
          setPresets(payload.map(mapApiPreset));
        }
      } catch {
        if (!cancelled) {
          setPresetError("Nao foi possivel carregar os presets.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPresets(false);
        }
      }
    }

    void loadPresets();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    latestStateRef.current = {
      bpm,
      timeSignature,
      accentFirstBeat,
      subdivision,
      soundStyle,
      trainingEnabled,
      trainingTargetBpm,
      trainingStepBpm,
      trainingEveryBars,
    };
  }, [
    bpm,
    timeSignature,
    accentFirstBeat,
    subdivision,
    soundStyle,
    trainingEnabled,
    trainingTargetBpm,
    trainingStepBpm,
    trainingEveryBars,
  ]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      void audioContextRef.current?.close();
    };
  }, []);

  const playTick = (isAccent: boolean, isSubdivision: boolean) => {
    const audioWindow = window as AudioWindow;
    const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;

    if (!AudioContextCtor) return;

    audioContextRef.current ??= new AudioContextCtor();
    const context = audioContextRef.current;

    if (context.state === "suspended") {
      void context.resume();
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const style = latestStateRef.current.soundStyle;

    if (style === "wood") {
      oscillator.type = "square";
      oscillator.frequency.value = isAccent ? 1320 : isSubdivision ? 660 : 880;
    } else if (style === "soft") {
      oscillator.type = "sine";
      oscillator.frequency.value = isAccent ? 880 : isSubdivision ? 440 : 620;
    } else {
      oscillator.type = "triangle";
      oscillator.frequency.value = isAccent ? 1600 : isSubdivision ? 700 : 1000;
    }

    const volume = isAccent ? 0.55 : isSubdivision ? 0.16 : 0.34;
    const decay = style === "soft" ? 0.09 : 0.045;

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + decay);
  };

  const scheduleNextTick = () => {
    const state = latestStateRef.current;
    const currentBeatsPerBar = getBeatCount(state.timeSignature);
    const currentSubdivisionCount = Number(state.subdivision);
    const currentBeat = beatIndexRef.current;
    const currentSubdivision = subdivisionIndexRef.current;
    const isDownbeat = currentBeat === 0 && currentSubdivision === 0;
    const isSubdivisionTick = currentSubdivision > 0;

    setActiveBeat(currentBeat);
    setActiveSubdivision(currentSubdivision);
    playTick(state.accentFirstBeat && isDownbeat, isSubdivisionTick);

    const nextSubdivision = currentSubdivision + 1;

    if (nextSubdivision >= currentSubdivisionCount) {
      subdivisionIndexRef.current = 0;
      beatIndexRef.current = (currentBeat + 1) % currentBeatsPerBar;

      if (beatIndexRef.current === 0) {
        barCountRef.current += 1;
        setTrainingBarsDone(barCountRef.current);

        if (
          state.trainingEnabled &&
          barCountRef.current % state.trainingEveryBars === 0 &&
          state.bpm < state.trainingTargetBpm
        ) {
          setBpm((current) => Math.min(state.trainingTargetBpm, current + state.trainingStepBpm));
        }
      }
    } else {
      subdivisionIndexRef.current = nextSubdivision;
    }

    const intervalMs = 60000 / latestStateRef.current.bpm / currentSubdivisionCount;
    timerRef.current = window.setTimeout(scheduleNextTick, intervalMs);
  };

  const start = () => {
    if (isPlaying) return;

    beatIndexRef.current = activeBeat;
    subdivisionIndexRef.current = 0;
    setIsPlaying(true);
    scheduleNextTick();
  };

  const stop = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
    setActiveSubdivision(0);
  };

  const togglePlay = () => {
    if (isPlaying) {
      stop();
      return;
    }

    start();
  };

  const handleTapTempo = () => {
    const now = performance.now();
    const nextTapTimes = [...tapTimes.filter((time) => now - time <= TAP_RESET_MS), now].slice(-6);
    setTapTimes(nextTapTimes);

    if (nextTapTimes.length < 2) return;

    const intervals = nextTapTimes.slice(1).map((time, index) => time - nextTapTimes[index]);
    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    setBpm(clampBpm(60000 / averageInterval));
  };

  const handleBpmInput = (value: string) => {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      setBpm(clampBpm(numericValue));
    }
  };

  const savePreset = async () => {
    const name = presetName.trim() || `${bpm} BPM ${timeSignature}`;
    const preset = getPresetPayload(
      name,
      bpm,
      timeSignature,
      accentFirstBeat,
      subdivision,
      soundStyle
    );

    setIsSavingPreset(true);
    setPresetError(null);

    try {
      const response = await fetch("/api/bpm-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preset),
      });

      if (!response.ok) {
        throw new Error("Failed to save preset");
      }

      const savedPreset = (await response.json()) as ApiPreset;
      setPresets((current) => [mapApiPreset(savedPreset), ...current]);
      setPresetName(name);
    } catch {
      setPresetError("Nao foi possivel salvar o preset.");
    } finally {
      setIsSavingPreset(false);
    }
  };

  const loadPreset = (preset: Preset) => {
    setBpm(preset.bpm);
    setTimeSignature(preset.timeSignature);
    setAccentFirstBeat(preset.accentFirstBeat);
    setSubdivision(preset.subdivision);
    setSoundStyle(preset.soundStyle);
    setPresetName(preset.name);
    beatIndexRef.current = 0;
    subdivisionIndexRef.current = 0;
    setActiveBeat(0);
    setActiveSubdivision(0);
  };

  const deletePreset = async (presetId: number) => {
    const previousPresets = presets;
    setPresets((current) => current.filter((preset) => preset.id !== presetId));
    setPresetError(null);

    try {
      const response = await fetch(`/api/bpm-presets/${presetId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete preset");
      }
    } catch {
      setPresets(previousPresets);
      setPresetError("Nao foi possivel excluir o preset.");
    }
  };

  const resetTraining = () => {
    barCountRef.current = 0;
    setTrainingBarsDone(0);
  };

  return (
    <main className="min-h-[calc(100vh-5rem)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Gauge className="h-4 w-4" />
              BPM Lab
            </div>
            <div>
              <h1 className="text-4xl font-display font-bold tracking-tight sm:text-5xl">
                Metronomo personalizavel
              </h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Controle tempo, compasso, acentos, subdivisoes, sons, presets e treino progressivo em uma tela dedicada.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant={isPlaying ? "secondary" : "glow"}
            size="lg"
            onClick={togglePlay}
            className="w-full sm:w-auto"
          >
            {isPlaying ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
            {isPlaying ? "Pause" : "Play"}
          </Button>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="glass-panel rounded-2xl p-6 sm:p-8">
            <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-background/40 p-6">
                <div className="text-sm font-medium uppercase tracking-[0.25em] text-muted-foreground">
                  BPM
                </div>
                <div className="mt-4 font-display text-8xl font-bold leading-none text-glow sm:text-9xl">
                  {bpm}
                </div>
                <div className="mt-5 grid w-full max-w-sm grid-cols-3 gap-2">
                  <Button type="button" variant="secondary" onClick={() => setBpm((value) => clampBpm(value - 1))}>
                    -1
                  </Button>
                  <Button type="button" variant="outline" onClick={handleTapTempo}>
                    Tap
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setBpm((value) => clampBpm(value + 1))}>
                    +1
                  </Button>
                </div>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Toque no Tap Tempo algumas vezes para calcular o pulso.
                </p>
              </div>

              <div className="space-y-7">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-sm font-medium text-muted-foreground">BPM ajustavel</label>
                    <Input
                      type="number"
                      min={MIN_BPM}
                      max={MAX_BPM}
                      value={bpm}
                      onChange={(event) => handleBpmInput(event.target.value)}
                      className="h-10 w-24 text-center"
                    />
                  </div>
                  <Slider
                    min={MIN_BPM}
                    max={MAX_BPM}
                    step={1}
                    value={[bpm]}
                    onValueChange={([value]) => setBpm(value)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <ControlGroup label="Compasso">
                    <Select value={timeSignature} onValueChange={(value) => setTimeSignature(value as TimeSignature)}>
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
                  </ControlGroup>

                  <ControlGroup label="Som">
                    <Select value={soundStyle} onValueChange={(value) => setSoundStyle(value as SoundStyle)}>
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
                  </ControlGroup>

                  <ControlGroup label="Subdivisao simples">
                    <Select value={subdivision} onValueChange={(value) => setSubdivision(value as Subdivision)}>
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
                  </ControlGroup>

                  <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-background/40 p-4">
                    <div>
                      <div className="text-sm font-medium">Acento no primeiro tempo</div>
                      <div className="text-xs text-muted-foreground">Realca o tempo 1 do compasso.</div>
                    </div>
                    <Switch checked={accentFirstBeat} onCheckedChange={setAccentFirstBeat} />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-background/40 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Volume2 className="h-4 w-4 text-primary" />
                      Pulso atual
                    </div>
                    <span className="text-sm text-muted-foreground">{timeSignature}</span>
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${beatsPerBar}, minmax(0, 1fr))` }}>
                    {beatLabels.map((beat, index) => (
                      <div
                        key={beat}
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-2xl border text-2xl font-bold transition-all",
                          activeBeat === index
                            ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                            : "border-white/10 bg-secondary/50 text-muted-foreground",
                          index === 0 && accentFirstBeat && "ring-1 ring-primary/30"
                        )}
                      >
                        {beat}
                      </div>
                    ))}
                  </div>
                  {subdivisionCount > 1 ? (
                    <div className="mt-4 flex justify-center gap-2">
                      {Array.from({ length: subdivisionCount }, (_, index) => (
                        <span
                          key={index}
                          className={cn(
                            "h-2 w-8 rounded-full bg-muted transition-colors",
                            activeSubdivision === index && "bg-primary"
                          )}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="glass-panel rounded-2xl p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-display font-bold">Modo treino</h2>
                  <p className="text-sm text-muted-foreground">Aumenta o BPM por blocos de compassos.</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-background/40 p-4">
                  <span className="text-sm font-medium">Ativar treino gradual</span>
                  <Switch checked={trainingEnabled} onCheckedChange={setTrainingEnabled} />
                </div>

                <TrainingNumberField
                  label="BPM alvo"
                  value={trainingTargetBpm}
                  min={bpm}
                  max={MAX_BPM}
                  onChange={(value) => setTrainingTargetBpm(clampBpm(value))}
                />
                <TrainingNumberField
                  label="Aumento por etapa"
                  value={trainingStepBpm}
                  min={1}
                  max={20}
                  onChange={setTrainingStepBpm}
                />
                <TrainingNumberField
                  label="A cada compassos"
                  value={trainingEveryBars}
                  min={1}
                  max={32}
                  onChange={setTrainingEveryBars}
                />

                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-background/40 p-4 text-sm">
                  <span className="text-muted-foreground">Compassos tocados</span>
                  <strong>{trainingBarsDone}</strong>
                </div>

                <Button type="button" variant="outline" className="w-full" onClick={resetTraining}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reiniciar treino
                </Button>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ListPlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-display font-bold">Presets salvos</h2>
                  <p className="text-sm text-muted-foreground">Guarde configuracoes para ensaio.</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                  placeholder="Nome do preset"
                />
                <Button
                  type="button"
                  size="icon"
                  aria-label="Salvar preset"
                  onClick={savePreset}
                  disabled={isSavingPreset}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {presetError ? (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    {presetError}
                  </div>
                ) : null}

                {isLoadingPresets ? (
                  <div className="rounded-2xl border border-white/5 p-5 text-center text-sm text-muted-foreground">
                    Carregando presets...
                  </div>
                ) : presets.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-muted-foreground">
                    Nenhum preset salvo ainda.
                  </div>
                ) : (
                  presets.map((preset) => (
                    <div key={preset.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-background/40 p-3">
                      <button
                        type="button"
                        onClick={() => loadPreset(preset)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate font-medium">{preset.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {preset.bpm} BPM - {preset.timeSignature} - {subdivisionOptions.find((option) => option.value === preset.subdivision)?.label}
                        </div>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir preset ${preset.name}`}
                        onClick={() => deletePreset(preset.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function TrainingNumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const handleChange = (nextValue: string) => {
    const numericValue = Number(nextValue);

    if (!Number.isFinite(numericValue)) return;

    onChange(Math.min(max, Math.max(min, Math.round(numericValue))));
  };

  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-background/40 p-4">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        className="h-10 w-24 text-center"
      />
    </label>
  );
}
