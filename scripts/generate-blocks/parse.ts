/**
 * Pure parsing logic for the block-definition generator.
 *
 * Every function here is a pure transform from XML text (or already-parsed
 * objects) to plain data — NO `fs`, no network, no globals. That keeps the
 * hard-to-get-right bits (mass arithmetic, unit conversions, category mapping,
 * the downgrade rules) unit-testable from small committed fixtures, so CI can
 * verify them without the game installed.
 *
 * The disk-touching orchestration lives in `index.ts`.
 */

import { XMLParser } from 'fast-xml-parser';
import type { BlockDefinition, Dlc, GridSize, ThrusterType } from '../../src/data/schema';
import {
  DLC_TAG_TO_ID,
  MWH_TO_WH,
  MW_TO_W,
  XSI_TYPE_TO_CATEGORY,
} from './config';

/**
 * Shared parser config — mirrors the blueprint parser
 * (`src/core/blueprint/parse.ts`) so `@_xsi:type` is addressable and numeric
 * element text is trimmed. `parseAttributeValue: false` keeps `@_Count` /
 * `@_Subtype` as strings we coerce explicitly.
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: false,
  parseAttributeValue: false,
  trimValues: true,
});

/** A diagnostic emitted while parsing — surfaced by the CLI, never swallowed. */
export interface Diagnostic {
  readonly kind: 'downgraded-stat' | 'zero-mass' | 'unmapped-dlc' | 'skipped-non-public';
  readonly subtypeId: string;
  readonly detail: string;
}

/** Context threaded through block construction. */
export interface ParseContext {
  readonly componentMasses: ReadonlyMap<string, number>;
  readonly displayNames: ReadonlyMap<string, string>;
}

/** Result of turning one `<Definition>` into a block (or deciding not to). */
export interface BuildResult {
  readonly block: BlockDefinition | null;
  readonly diagnostics: readonly Diagnostic[];
}

/** Normalize a fast-xml-parser field that may be a single item or an array. */
function toArray<T>(v: T | readonly T[] | undefined): readonly T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v as T];
}

/** True for values we can safely stringify without `[object Object]`. */
function isPrimitive(v: unknown): v is string | number | boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

/** Coerce element text (string | number | boolean) to a finite number, or undefined. */
function num(v: unknown): number | undefined {
  if (!isPrimitive(v) || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse `Components.sbc` into a map of component SubtypeId → unit mass (kg).
 * This is the basis of every block's derived mass.
 */
export function parseComponentMasses(componentsXml: string): Map<string, number> {
  const doc = parser.parse(componentsXml) as {
    Definitions?: { Components?: { Component?: unknown } };
  };
  const masses = new Map<string, number>();
  const components = toArray(doc.Definitions?.Components?.Component) as Array<{
    Id?: { SubtypeId?: string };
    Mass?: unknown;
  }>;
  for (const c of components) {
    const subtype = c.Id?.SubtypeId;
    const mass = num(c.Mass);
    if (typeof subtype === 'string' && mass !== undefined) masses.set(subtype, mass);
  }
  return masses;
}

/**
 * Parse the localization `.resx` into a map of key → English display string.
 * Block `<DisplayName>` fields are localization keys (e.g.
 * `DisplayName_Block_SmallAtmoThrust`); this resolves them to human text.
 */
export function parseDisplayNames(resxXml: string): Map<string, string> {
  const doc = parser.parse(resxXml) as {
    root?: { data?: unknown };
  };
  const names = new Map<string, string>();
  const entries = toArray(doc.root?.data) as Array<{
    '@_name'?: string;
    value?: unknown;
  }>;
  for (const e of entries) {
    const key = e['@_name'];
    if (typeof key !== 'string') continue;
    const value = e.value;
    if (typeof value === 'string') names.set(key, value);
    else if (typeof value === 'number') names.set(key, String(value));
  }
  return names;
}

/** Raw shape of a `<Definition>` element after XML parsing (fields we read). */
export interface RawDefinition {
  '@_xsi:type'?: string;
  Id?: { SubtypeId?: string; TypeId?: string };
  DisplayName?: unknown;
  CubeSize?: unknown;
  Public?: unknown;
  DLC?: unknown;
  Components?: { Component?: unknown };
  Size?: { '@_x'?: unknown; '@_y'?: unknown; '@_z'?: unknown };
  // stat fields (present depending on type)
  ThrusterType?: unknown;
  ForceMagnitude?: unknown;
  MaxPowerConsumption?: unknown;
  MinPlanetaryInfluence?: unknown;
  MaxPlanetaryInfluence?: unknown;
  EffectivenessAtMinInfluence?: unknown;
  EffectivenessAtMaxInfluence?: unknown;
  MaxPowerOutput?: unknown;
  RequiredPowerInput?: unknown;
  MaxStoredPower?: unknown;
}

/** Extract every `<Definition>` from one `CubeBlocks/*.sbc` file. */
export function parseCubeBlocksFile(sbcXml: string): RawDefinition[] {
  const doc = parser.parse(sbcXml) as {
    Definitions?: { CubeBlocks?: { Definition?: unknown } };
  };
  return toArray(doc.Definitions?.CubeBlocks?.Definition) as RawDefinition[];
}

/** Strip the `MyObjectBuilder_` prefix (and any namespace) from an `xsi:type`. */
export function normalizeXsiType(xsiType: string | undefined): string | undefined {
  if (!xsiType) return undefined;
  return xsiType.replace(/^(?:[a-zA-Z0-9]+:)?MyObjectBuilder_/, '');
}

/** True when a definition is buildable — i.e. NOT explicitly `<Public>false</Public>`. */
export function isPublic(def: RawDefinition): boolean {
  const p = def.Public;
  // Absent tag defaults to public (armor blocks omit it entirely).
  if (p === undefined || p === null) return true;
  if (typeof p === 'boolean') return p;
  if (!isPrimitive(p)) return true;
  return String(p).trim().toLowerCase() !== 'false';
}

/** Map a `<DLC>` tag to our {@link Dlc} id. Absent → base. Unmapped → throws. */
export function dlcFromTag(def: RawDefinition): Dlc {
  const raw = def.DLC;
  if (raw === undefined || raw === null) return 'base';
  // A block carries at most one DLC tag in vanilla; guard against arrays anyway.
  const first = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
  const tag = isPrimitive(first) ? String(first).trim() : '';
  const mapped = DLC_TAG_TO_ID[tag];
  if (!mapped) {
    throw new Error(`Unmapped <DLC> tag "${tag}" — add it to DLC_TAG_TO_ID in config.ts`);
  }
  return mapped;
}

/** Sum component masses for a definition. Unknown components contribute 0. */
export function massFromComponents(
  def: RawDefinition,
  componentMasses: ReadonlyMap<string, number>,
): number {
  const components = toArray(def.Components?.Component) as Array<{
    '@_Subtype'?: string;
    '@_Count'?: unknown;
  }>;
  let total = 0;
  for (const c of components) {
    const subtype = c['@_Subtype'];
    const count = num(c['@_Count']) ?? 0;
    if (typeof subtype === 'string') total += (componentMasses.get(subtype) ?? 0) * count;
  }
  return total;
}

/** Grid cells occupied (x·y·z), when the `<Size>` element is present. */
function cellCountFromSize(def: RawDefinition): number | undefined {
  const s = def.Size;
  if (!s) return undefined;
  const x = num(s['@_x']);
  const y = num(s['@_y']);
  const z = num(s['@_z']);
  if (x === undefined || y === undefined || z === undefined) return undefined;
  return x * y * z;
}

function gridSizeFrom(def: RawDefinition): GridSize {
  const raw = def.CubeSize;
  const s = isPrimitive(raw) ? String(raw).trim().toLowerCase() : '';
  return s === 'small' ? 'small' : 'large';
}

function thrusterTypeFrom(raw: unknown): ThrusterType | undefined {
  const s = isPrimitive(raw) ? String(raw).trim().toLowerCase() : '';
  switch (s) {
    case 'atmospheric':
      return 'atmospheric';
    case 'ion':
      return 'ion';
    case 'hydrogen':
      return 'hydrogen';
    default:
      return undefined;
  }
}

/** Only-defined-keys spread helper (exactOptionalPropertyTypes-safe). */
function opt<K extends string, V>(key: K, value: V | undefined): Record<K, V> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

/**
 * Build one {@link BlockDefinition} from a raw `<Definition>`.
 *
 * Rules:
 * - `<Public>false</Public>` → skipped (non-buildable).
 * - Mass ≤ 0 (no/unknown components) → skipped with a diagnostic (a zero-mass
 *   block would corrupt the mass>0 invariant and is useless for physics).
 * - A stat-bearing `xsi:type` missing a REQUIRED schema field → downgraded to a
 *   mass-only `'other'` block + a diagnostic (never a fabricated 0-thrust ghost
 *   that would corrupt TWR — same philosophy as resolve-block.ts).
 * - Everything else with no stat category → mass-only `'other'`.
 */
export function buildBlock(def: RawDefinition, ctx: ParseContext): BuildResult {
  const diagnostics: Diagnostic[] = [];
  const subtypeId = def.Id?.SubtypeId?.trim();
  if (!subtypeId) return { block: null, diagnostics };

  if (!isPublic(def)) {
    diagnostics.push({ kind: 'skipped-non-public', subtypeId, detail: 'Public=false' });
    return { block: null, diagnostics };
  }

  const mass = massFromComponents(def, ctx.componentMasses);
  if (mass <= 0) {
    diagnostics.push({
      kind: 'zero-mass',
      subtypeId,
      detail: 'no components resolved to a positive mass',
    });
    return { block: null, diagnostics };
  }

  const gridSize = gridSizeFrom(def);
  const dlc = dlcFromTag(def);
  const cellCount = cellCountFromSize(def);
  const displayKey = typeof def.DisplayName === 'string' ? def.DisplayName : undefined;
  const displayName =
    (displayKey && ctx.displayNames.get(displayKey)) || displayKey || subtypeId;

  const base = {
    id: `gen:${subtypeId}`,
    subtypeId,
    displayName,
    gridSize,
    dlc,
    mass,
    source: 'definition' as const,
    ...opt('cellCount', cellCount),
  };

  const category = XSI_TYPE_TO_CATEGORY[normalizeXsiType(def['@_xsi:type']) ?? ''];

  // Mass-only block: no stat category (armor, cargo, cockpit, weapons, tools…).
  const generic = (): BuildResult => ({
    block: { ...base, category: 'other' as const },
    diagnostics,
  });

  if (!category) return generic();

  const downgrade = (missing: string): BuildResult => {
    diagnostics.push({
      kind: 'downgraded-stat',
      subtypeId,
      detail: `${category} missing ${missing}; emitted as mass-only 'other'`,
    });
    return generic();
  };

  switch (category) {
    case 'thruster': {
      const maxThrust = num(def.ForceMagnitude);
      const thrusterType = thrusterTypeFrom(def.ThrusterType);
      if (maxThrust === undefined) return downgrade('ForceMagnitude');
      if (thrusterType === undefined) return downgrade('ThrusterType');
      const powerMw = num(def.MaxPowerConsumption);
      return {
        block: {
          ...base,
          category: 'thruster',
          thrusterType,
          maxThrust,
          maxPowerDraw: powerMw === undefined ? 0 : powerMw * MW_TO_W,
          ...opt('minPlanetaryInfluence', num(def.MinPlanetaryInfluence)),
          ...opt('maxPlanetaryInfluence', num(def.MaxPlanetaryInfluence)),
          ...opt('effectivenessAtMinInfluence', num(def.EffectivenessAtMinInfluence)),
          ...opt('effectivenessAtMaxInfluence', num(def.EffectivenessAtMaxInfluence)),
        },
        diagnostics,
      };
    }
    case 'battery': {
      const outMw = num(def.MaxPowerOutput);
      const inMw = num(def.RequiredPowerInput);
      const storedMwh = num(def.MaxStoredPower);
      if (outMw === undefined) return downgrade('MaxPowerOutput');
      if (inMw === undefined) return downgrade('RequiredPowerInput');
      if (storedMwh === undefined) return downgrade('MaxStoredPower');
      return {
        block: {
          ...base,
          category: 'battery',
          maxPowerOutput: outMw * MW_TO_W,
          maxPowerInput: inMw * MW_TO_W,
          energyCapacity: storedMwh * MWH_TO_WH,
        },
        diagnostics,
      };
    }
    case 'gyroscope': {
      const maxTorque = num(def.ForceMagnitude);
      if (maxTorque === undefined) return downgrade('ForceMagnitude');
      const powerMw = num(def.RequiredPowerInput);
      return {
        block: {
          ...base,
          category: 'gyroscope',
          maxTorque,
          powerDraw: powerMw === undefined ? 0 : powerMw * MW_TO_W,
        },
        diagnostics,
      };
    }
    case 'solar':
    case 'wind-turbine':
    case 'reactor':
    case 'hydrogen-engine': {
      const outMw = num(def.MaxPowerOutput);
      if (outMw === undefined) return downgrade('MaxPowerOutput');
      return {
        block: {
          ...base,
          category,
          maxPowerOutput: outMw * MW_TO_W,
        },
        diagnostics,
      };
    }
    default:
      return generic();
  }
}
