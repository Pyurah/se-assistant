/**
 * EstimatorCombatPanel — DPS and ammo burn for the *estimated* build.
 *
 * The Estimate-mode counterpart to Analyze's CombatPanel: it runs the same
 * trusted `combatAnalysis` engine on the synthesized {@link ShipDesign} from
 * `useEstimate` (via `estimateToDesign`) instead of an imported blueprint. Since
 * weapons are now selectable in the essentials palette (curated `weapon` blocks),
 * a user can declare turrets/guns and see the ship's firepower before building.
 *
 * Mirrors EstimatorTwrPanel's contract: renders nothing until there are
 * essentials to size against, and self-hides its body via the engine's unarmed
 * empty state when no weapons are declared.
 *
 * Damage is NOT one comparable number in Space Engineers — kinetic rounds deal
 * HP damage, missiles explosion damage, shells/slugs draw from a health pool.
 * Rows are labelled by kind so the figures are read honestly.
 */
import { useState } from 'react';
import { combatAnalysis } from '@core';
import type { DamageKind } from '@data';
import { useEstimate } from '../../app/hooks/use-estimate';
import { formatDuration, formatCount } from '../lib/format';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';
import { Stepper } from '../components/Stepper';
import { IconBolt, IconWarning, IconGauge } from '../components/icons';

/** Human label + short unit note for each damage family. */
const DAMAGE_KIND_META: Record<DamageKind, { label: string; note: string }> = {
  health: { label: 'Kinetic', note: 'HP damage' },
  explosion: { label: 'Explosive', note: 'area damage' },
  pool: { label: 'Shell/slug', note: 'health-pool' },
};

/** Compact DPS number: no unit suffix (the column header carries "DPS"). */
function formatDps(dps: number): string {
  return dps.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function EstimatorCombatPanel(): React.JSX.Element | null {
  const [magazinesPerWeapon, setMagazinesPerWeapon] = useState(1);
  const result = useEstimate();

  // Only render once there's a build to analyze (mirrors EstimatorTwrPanel).
  if (!result || result.isEmpty) return null;

  const combat = combatAnalysis(result.design, { magazinesPerWeapon });
  const {
    isArmed,
    weapons,
    weaponCount,
    weaponTypeCount,
    totalBurstDps,
    totalSustainedDps,
    fireDurationSeconds,
    unrecognizedWeapons,
  } = combat;

  // Empty state: no recognized weapons. Since the estimator never places weapons
  // on its own, this is the common case until the user declares one as essential.
  if (!isArmed) {
    return (
      <Panel title="Combat" icon={<IconBolt size={16} />} subtitle="weapons & DPS">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-bg p-3 text-sm">
          <span className="mt-0.5 shrink-0 text-info">
            <IconBolt size={18} />
          </span>
          <div>
            <p className="font-medium text-fg">
              {unrecognizedWeapons.length > 0 ? 'No scored weapons' : 'Unarmed'}
            </p>
            <p className="text-muted">
              {unrecognizedWeapons.length > 0
                ? `This build has ${formatCount(unrecognizedWeapons.length)} weapon-like block type(s) with no curated firing stats — DPS can't be computed for them yet.`
                : 'Add weapons to your essentials to see the build’s DPS and how long its ammo lasts.'}
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Combat"
      icon={<IconBolt size={16} />}
      subtitle={`${formatCount(weaponCount)} weapon${weaponCount === 1 ? '' : 's'}, ${formatCount(weaponTypeCount)} type${weaponTypeCount === 1 ? '' : 's'}`}
      actions={
        <div className="flex items-center gap-2">
          <span className="text-xs text-subtle">Mags/weapon</span>
          <Stepper
            value={magazinesPerWeapon}
            onChange={setMagazinesPerWeapon}
            min={0}
            max={99}
            ariaLabel="magazines per weapon"
          />
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Burst DPS" value={formatDps(totalBurstDps)} tone="accent" hint="trigger held" />
          <Stat label="Sustained DPS" value={formatDps(totalSustainedDps)} hint="reloads included" />
          <Stat label="Ammo lasts" value={formatDuration(fireDurationSeconds)} hint="full-rate fire" />
        </div>

        {/* Per-weapon-type rows. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
              Weapons
            </span>
            <span className="flex items-center gap-1 text-xs text-muted">
              <IconGauge size={12} />
              <span>burst / sustained DPS</span>
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-border/60">
            {weapons.map((w) => (
              <li
                key={w.subtypeId}
                className="flex items-center justify-between gap-3 py-1.5"
                title={`${w.displayName} (${w.subtypeId}) — ${w.roundDisplayName}`}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-fg">
                    {w.displayName}
                    {w.quantity > 1 && <span className="text-subtle"> ×{w.quantity}</span>}
                  </span>
                  <span className="text-[11px] text-subtle">
                    {DAMAGE_KIND_META[w.damageKind].label} · {w.roundDisplayName}
                    {w.isTurret && ' · turret'}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="font-mono text-sm tabular-nums text-fg-bright">
                    {formatDps(w.totalBurstDps)}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-muted">
                    {formatDps(w.totalSustainedDps)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-subtle">
          Damage isn&apos;t one comparable number: kinetic rounds deal HP damage, missiles area
          damage, shells/slugs draw from a health pool — rows are labelled by kind. No target-armour
          or time-to-kill model.
        </p>

        {unrecognizedWeapons.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-medium text-warning">
              <IconWarning size={14} />
              <span>DPS known for {formatCount(weaponTypeCount)} weapon type(s); unscored below</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unrecognizedWeapons.map((subtypeId) => (
                <span
                  key={subtypeId}
                  className="rounded-md border border-border bg-bg px-1.5 py-0.5 font-mono text-[11px] text-muted"
                  title={`${subtypeId} — no curated firing stats`}
                >
                  {subtypeId}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
