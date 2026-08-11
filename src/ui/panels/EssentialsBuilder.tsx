/**
 * EssentialsBuilder — add the ship's essential gear for the chosen grid.
 *
 * This is the estimator's input surface: the user adds their must-have blocks
 * — drills, cargo, a cockpit, tools, lights — with a per-block quantity stepper.
 * Grid size (which filters everything selectable) is chosen in the scenario bar
 * above; this panel reads it. Propulsion, power, and gyros are NOT added here;
 * the estimator sizes those, so the palette deliberately hides
 * thrusters/batteries/reactors/gyros. A running tally (block count + essentials
 * mass) keeps the cost of choices visible.
 *
 * The palette is a searchable, category-grouped list; every control is a real
 * labeled button/input so it stays keyboard- and screen-reader operable.
 */
import { useMemo, useState } from 'react';
import {
  VANILLA_BLOCKS,
  SIZED_CATEGORIES,
  type BlockCategory,
  type BlockDefinition,
} from '@data';
import { useEstimatorStore } from '../../app/store/estimator-store';
import { useEstimate } from '../../app/hooks/use-estimate';
import { CATEGORY_LABELS, CATEGORY_COLOR, CATEGORY_ORDER } from '../lib/category-meta';
import { formatMass } from '../lib/format';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { IconLayers, IconSearch, IconPlus, IconMinus, IconTrash } from '../components/icons';
import { cn } from '../lib/cn';

/** Palette order: only the categories a user declares as essentials. */
const PALETTE_CATEGORIES: readonly BlockCategory[] = CATEGORY_ORDER.filter(
  (c) => !SIZED_CATEGORIES.has(c),
);

export function EssentialsBuilder(): React.JSX.Element {
  const gridSize = useEstimatorStore((s) => s.gridSize);
  const fixedBlocks = useEstimatorStore((s) => s.fixedBlocks);
  const addBlock = useEstimatorStore((s) => s.addBlock);
  const removeBlock = useEstimatorStore((s) => s.removeBlock);
  const setQuantity = useEstimatorStore((s) => s.setQuantity);
  const result = useEstimate();

  const [query, setQuery] = useState('');

  const quantityById = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of fixedBlocks) map.set(b.id, b.quantity);
    return map;
  }, [fixedBlocks]);

  // Selectable palette: this grid's blocks, minus the sized categories, grouped.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byCategory = new Map<BlockCategory, BlockDefinition[]>();
    for (const block of VANILLA_BLOCKS) {
      if (block.gridSize !== gridSize) continue;
      if (SIZED_CATEGORIES.has(block.category)) continue;
      if (q && !block.displayName.toLowerCase().includes(q)) continue;
      const list = byCategory.get(block.category) ?? [];
      list.push(block);
      byCategory.set(block.category, list);
    }
    return PALETTE_CATEGORIES.map((category) => ({
      category,
      blocks: byCategory.get(category) ?? [],
    })).filter((g) => g.blocks.length > 0);
  }, [gridSize, query]);

  const essentialsCount = result?.essentialsCount ?? 0;
  const essentialsMass = result?.essentialsMass ?? 0;
  const resolvedFixed = result?.resolvedFixed ?? [];

  return (
    <Panel
      title="Essential gear"
      subtitle="Declare must-haves; the estimator sizes propulsion, power & gyros"
      icon={<IconLayers size={16} />}
    >
      <div className="flex flex-col gap-5">
        {/* Chosen essentials with quantity steppers. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">
              Your essentials
            </span>
            <div className="flex items-center gap-2 text-xs text-subtle">
              <span className="font-mono text-fg">{essentialsCount}</span>
              <span>blocks ·</span>
              <span className="font-mono text-fg">{formatMass(essentialsMass)}</span>
            </div>
          </div>

          {resolvedFixed.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-bg px-3 py-4 text-center text-sm text-subtle">
              No essentials yet. Add your gear below — e.g. 4 drills, 2 cargo, 1 cockpit.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {resolvedFixed.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-bg px-2.5 py-1.5"
                >
                  <span
                    className={cn('size-2.5 shrink-0 rounded-sm', CATEGORY_COLOR[b.definition.category])}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-fg" title={b.definition.displayName}>
                    {b.definition.displayName}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQuantity(b.id, b.quantity - 1)}
                      aria-label={`Decrease ${b.definition.displayName} quantity`}
                      className="flex size-6 items-center justify-center rounded-md border border-border bg-surface-2 text-muted transition-colors hover:border-border-strong hover:text-fg"
                    >
                      <IconMinus size={13} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={b.quantity}
                      onChange={(e) => setQuantity(b.id, Number(e.target.value))}
                      aria-label={`${b.definition.displayName} quantity`}
                      className="h-6 w-12 rounded-md border border-border bg-surface px-1 text-center font-mono text-sm text-fg transition-colors hover:border-border-strong focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(b.id, b.quantity + 1)}
                      aria-label={`Increase ${b.definition.displayName} quantity`}
                      className="flex size-6 items-center justify-center rounded-md border border-border bg-surface-2 text-muted transition-colors hover:border-border-strong hover:text-fg"
                    >
                      <IconPlus size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBlock(b.id)}
                      aria-label={`Remove ${b.definition.displayName}`}
                      className="ml-1 flex size-6 items-center justify-center rounded-md text-subtle transition-colors hover:bg-danger/15 hover:text-danger"
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Searchable, categorized palette. */}
        <div className="flex flex-col gap-2">
          <label className="relative flex items-center">
            <span className="pointer-events-none absolute left-2.5 text-subtle">
              <IconSearch size={15} />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search blocks…"
              aria-label="Search essential blocks"
              className="h-9 w-full rounded-md border border-border bg-bg pr-3 pl-8 text-sm text-fg transition-colors hover:border-border-strong focus:border-accent"
            />
          </label>

          <div className="flex max-h-72 flex-col gap-3 overflow-y-auto pr-1">
            {grouped.length === 0 ? (
              <p className="py-4 text-center text-sm text-subtle">No blocks match “{query}”.</p>
            ) : (
              grouped.map(({ category, blocks }) => (
                <div key={category} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn('size-2 shrink-0 rounded-sm', CATEGORY_COLOR[category])}
                      aria-hidden
                    />
                    <span className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
                      {CATEGORY_LABELS[category]}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {blocks.map((block) => {
                      const count = quantityById.get(block.id) ?? 0;
                      const added = count > 0;
                      // Not added yet: whole row is an "add" button. Once added,
                      // the row exposes inline −/count/+ so a misclick can be
                      // backed out right here without hunting for the list above.
                      if (!added) {
                        return (
                          <button
                            key={block.id}
                            type="button"
                            onClick={() => addBlock(block.id)}
                            aria-label={`Add ${block.displayName}`}
                            className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-left text-sm text-muted transition-colors duration-150 hover:border-border-strong hover:text-fg"
                          >
                            <span className="text-subtle">
                              <IconPlus size={14} />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{block.displayName}</span>
                            <span className="font-mono text-xs text-subtle">
                              {formatMass(block.mass)}
                            </span>
                          </button>
                        );
                      }
                      return (
                        <div
                          key={block.id}
                          className="flex items-center gap-2 rounded-md border border-accent/50 bg-accent/10 px-2.5 py-1.5 text-sm text-fg"
                        >
                          <span className="min-w-0 flex-1 truncate">{block.displayName}</span>
                          <span className="font-mono text-xs text-subtle">
                            {formatMass(block.mass)}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setQuantity(block.id, count - 1)}
                              aria-label={`Decrease ${block.displayName} quantity`}
                              className="flex size-6 items-center justify-center rounded-md border border-border bg-surface-2 text-muted transition-colors hover:border-border-strong hover:text-fg"
                            >
                              <IconMinus size={13} />
                            </button>
                            <span className="w-6 text-center font-mono text-sm text-fg">{count}</span>
                            <button
                              type="button"
                              onClick={() => addBlock(block.id)}
                              aria-label={`Add ${block.displayName}`}
                              className="flex size-6 items-center justify-center rounded-md border border-border bg-surface-2 text-muted transition-colors hover:border-border-strong hover:text-fg"
                            >
                              <IconPlus size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {resolvedFixed.length > 0 && (
          <div>
            <Button
              variant="ghost"
              icon={<IconTrash size={14} />}
              onClick={() => {
                for (const b of resolvedFixed) removeBlock(b.id);
              }}
              className="text-subtle hover:text-danger"
            >
              Clear all essentials
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}
