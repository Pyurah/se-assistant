/**
 * BuildCostPanel — the bill of materials to construct the imported ship.
 *
 * Walks the manufacturing chain backwards (blocks → components → ingots → raw
 * ore) via the pure `buildCost` engine, and presents the two numbers a builder
 * actually plans around: how much **raw ore** to mine (by metal), and how long
 * it takes to **refine** it. Refinery/assembler presets and the world's
 * Assembler-Efficiency setting are adjustable, since they change the ore total
 * and the time materially.
 *
 * Honesty over false precision: blocks the dataset has no recipe for are listed
 * as "cost unknown" rather than silently counted as free — the panel says how
 * many block types are covered.
 */
import { useState } from 'react';
import {
  REFINERY_PRESETS,
  ASSEMBLER_PRESETS,
  DEFAULT_REFINERY,
  DEFAULT_ASSEMBLER,
  METAL_LABELS,
  type Metal,
} from '@data';
import { totalOreMass, totalIngotMass } from '@core';
import { useBuildCost } from '../../app/hooks/use-build-cost';
import { formatMass, formatDuration, formatCount } from '../lib/format';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';
import { StackedBar, type StackSegment } from '../components/StackedBar';
import { SegmentedControl } from '../components/SegmentedControl';
import { IconHammer, IconWarning } from '../components/icons';

/** Ordered metal palette (ingot tones) so a metal reads the same across the bar. */
const METAL_ORDER: readonly Metal[] = [
  'iron',
  'nickel',
  'cobalt',
  'silicon',
  'silver',
  'gold',
  'platinum',
  'magnesium',
  'uranium',
  'stone',
];

const METAL_COLOR: Record<Metal, string> = {
  iron: 'bg-[oklch(0.6_0.02_260)]',
  nickel: 'bg-[oklch(0.72_0.05_120)]',
  cobalt: 'bg-[oklch(0.62_0.14_255)]',
  silicon: 'bg-[oklch(0.75_0.04_60)]',
  silver: 'bg-[oklch(0.82_0.02_260)]',
  gold: 'bg-[oklch(0.82_0.15_90)]',
  platinum: 'bg-[oklch(0.85_0.03_200)]',
  magnesium: 'bg-[oklch(0.7_0.13_40)]',
  uranium: 'bg-[oklch(0.72_0.16_145)]',
  stone: 'bg-[oklch(0.58_0.03_80)]',
};

const EFFICIENCY_OPTIONS = [
  { value: '1', label: '×1' },
  { value: '3', label: '×3' },
  { value: '10', label: '×10' },
] as const;

export function BuildCostPanel(): React.JSX.Element | null {
  const [refineryId, setRefineryId] = useState(DEFAULT_REFINERY.id);
  const [assemblerId, setAssemblerId] = useState(DEFAULT_ASSEMBLER.id);
  const [efficiency, setEfficiency] = useState('1');

  const refinery = REFINERY_PRESETS.find((r) => r.id === refineryId) ?? DEFAULT_REFINERY;
  const assembler = ASSEMBLER_PRESETS.find((a) => a.id === assemblerId) ?? DEFAULT_ASSEMBLER;

  const cost = useBuildCost({
    refinery,
    assembler,
    assemblerEfficiency: Number(efficiency),
  });
  if (!cost) return null;

  const oreSegments: StackSegment[] = METAL_ORDER.map((metal) => ({
    key: metal,
    label: METAL_LABELS[metal],
    value: cost.ore[metal] ?? 0,
    colorClass: METAL_COLOR[metal],
  })).filter((s) => s.value > 0);

  const totalOre = totalOreMass(cost);
  const totalIngots = totalIngotMass(cost);
  const allUnknown = cost.knownBlockTypes === 0;

  return (
    <Panel
      title="Build cost"
      icon={<IconHammer size={16} />}
      subtitle="Raw materials to construct this ship"
    >
      <div className="flex flex-col gap-5">
        {allUnknown ? (
          <p className="text-sm text-subtle">
            No recognized blocks have a build recipe yet — nothing to cost.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Raw ore" value={formatMass(totalOre)} tone="accent" />
              <Stat label="Ingots" value={formatMass(totalIngots)} />
              <Stat
                label="Refine time"
                value={formatDuration(cost.refineTimeSeconds)}
                hint={`+${formatDuration(cost.assembleTimeSeconds)} assembling`}
              />
            </div>

            {oreSegments.length > 0 ? (
              <StackedBar segments={oreSegments} format={formatMass} />
            ) : (
              <p className="text-sm text-subtle">No ore-bearing components.</p>
            )}
          </>
        )}

        {/* Manufacturing settings — they change ore totals + time materially. */}
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
              Refinery
            </span>
            <SegmentedControl
              name="build-cost-refinery"
              ariaLabel="Refinery type"
              value={refineryId}
              options={REFINERY_PRESETS.map((r) => ({ value: r.id, label: r.displayName }))}
              onChange={setRefineryId}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
              Assembler
            </span>
            <SegmentedControl
              name="build-cost-assembler"
              ariaLabel="Assembler type"
              value={assemblerId}
              options={ASSEMBLER_PRESETS.map((a) => ({ value: a.id, label: a.displayName }))}
              onChange={setAssemblerId}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
              Assembler efficiency
            </span>
            <SegmentedControl
              name="build-cost-efficiency"
              ariaLabel="Assembler efficiency world setting"
              value={efficiency}
              options={EFFICIENCY_OPTIONS}
              onChange={setEfficiency}
            />
          </div>
        </div>

        {cost.unknownBlocks.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-medium text-warning">
              <IconWarning size={14} />
              <span>
                Cost known for {formatCount(cost.knownBlockTypes)} of{' '}
                {formatCount(cost.totalBlockTypes)} block types
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cost.unknownBlocks.map((b) => (
                <span
                  key={b.subtypeId}
                  className="rounded-md border border-border bg-bg px-1.5 py-0.5 font-mono text-[11px] text-muted"
                  title={`${b.displayName} ×${b.quantity} — no recipe in dataset`}
                >
                  {b.displayName}
                  {b.quantity > 1 && <span className="text-subtle"> ×{b.quantity}</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
