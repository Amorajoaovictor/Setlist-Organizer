import { db } from "./client";

export type BpmPreset = {
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

export type SaveBpmPresetInput = {
  name: string;
  bpm: number;
  timeSignature: BpmPreset["timeSignature"];
  accentFirstBeat: boolean;
  subdivision: BpmPreset["subdivision"];
  soundStyle: BpmPreset["soundStyle"];
};

type BpmPresetRow = {
  id: number;
  name: string;
  bpm: number;
  timeSignature: string;
  accentFirstBeat: boolean;
  subdivision: number;
  soundStyle: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function ensureBpmPresetsTable() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS bpm_presets (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      bpm INTEGER NOT NULL,
      time_signature TEXT NOT NULL DEFAULT '4/4',
      accent_first_beat BOOLEAN NOT NULL DEFAULT true,
      subdivision INTEGER NOT NULL DEFAULT 1,
      sound_style TEXT NOT NULL DEFAULT 'classic',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE bpm_presets
      ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Preset',
      ADD COLUMN IF NOT EXISTS bpm INTEGER NOT NULL DEFAULT 120,
      ADD COLUMN IF NOT EXISTS time_signature TEXT NOT NULL DEFAULT '4/4',
      ADD COLUMN IF NOT EXISTS accent_first_beat BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS subdivision INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS sound_style TEXT NOT NULL DEFAULT 'classic',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  `);
}

export async function listBpmPresets() {
  await ensureBpmPresetsTable();

  const rows = await db.$queryRawUnsafe<BpmPresetRow[]>(`
    SELECT
      id,
      name,
      bpm,
      time_signature AS "timeSignature",
      accent_first_beat AS "accentFirstBeat",
      subdivision,
      sound_style AS "soundStyle",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM bpm_presets
    ORDER BY updated_at DESC, id DESC
  `);

  return rows.map(mapBpmPresetRow);
}

export async function createBpmPreset(input: SaveBpmPresetInput) {
  await ensureBpmPresetsTable();

  const rows = await db.$queryRawUnsafe<BpmPresetRow[]>(
    `
      INSERT INTO bpm_presets (
        name,
        bpm,
        time_signature,
        accent_first_beat,
        subdivision,
        sound_style,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, now())
      RETURNING
        id,
        name,
        bpm,
        time_signature AS "timeSignature",
        accent_first_beat AS "accentFirstBeat",
        subdivision,
        sound_style AS "soundStyle",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    input.name,
    input.bpm,
    input.timeSignature,
    input.accentFirstBeat,
    input.subdivision,
    input.soundStyle,
  );

  return mapBpmPresetRow(rows[0]);
}

export async function deleteBpmPreset(id: number) {
  await ensureBpmPresetsTable();

  const rows = await db.$queryRawUnsafe<Array<{ id: number }>>(
    `
      DELETE FROM bpm_presets
      WHERE id = $1
      RETURNING id
    `,
    id,
  );

  return rows.length > 0;
}

function mapBpmPresetRow(row: BpmPresetRow): BpmPreset {
  return {
    id: row.id,
    name: row.name,
    bpm: row.bpm,
    timeSignature: normalizeTimeSignature(row.timeSignature),
    accentFirstBeat: row.accentFirstBeat,
    subdivision: normalizeSubdivision(row.subdivision),
    soundStyle: normalizeSoundStyle(row.soundStyle),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeTimeSignature(value: string): BpmPreset["timeSignature"] {
  return value === "2/4" || value === "3/4" || value === "6/8" ? value : "4/4";
}

function normalizeSubdivision(value: number): BpmPreset["subdivision"] {
  return value === 2 || value === 4 ? value : 1;
}

function normalizeSoundStyle(value: string): BpmPreset["soundStyle"] {
  return value === "wood" || value === "soft" ? value : "classic";
}
