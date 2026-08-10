/**
 * SpeedCapControl — preset chips + free numeric entry for the ship speed cap.
 *
 * Vanilla Space Engineers caps ships at 100 m/s, but servers frequently raise
 * it, so time/distance-to-top-speed calculations need an adjustable cap. Mirrors
 * the MotionPanel cruise-speed control so the two speed inputs feel identical.
 */
import { cn } from '../lib/cn';

/** SE's default cap and common raised-server limits, offered as one-tap presets. */
const SPEED_CAP_PRESETS: readonly number[] = [100, 300, 500];

export interface SpeedCapControlProps {
  /** Current raw input value (may be 0/NaN mid-edit; caller guards for math). */
  speed: number;
  onSpeedChange: (v: number) => void;
  className?: string;
}

export function SpeedCapControl({
  speed,
  onSpeedChange,
  className,
}: SpeedCapControlProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {SPEED_CAP_PRESETS.map((preset) => {
        const active = speed === preset;
        return (
          <button
            key={preset}
            type="button"
            onClick={() => onSpeedChange(preset)}
            aria-pressed={active}
            className={
              active
                ? 'rounded-md border border-accent bg-accent px-2.5 py-1 text-xs font-medium text-white transition-colors duration-150'
                : 'rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:border-border-strong hover:text-fg'
            }
          >
            {preset} m/s
          </button>
        );
      })}
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted">Speed cap</span>
        <input
          type="number"
          min={0}
          step={10}
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          aria-label="Maximum ship speed in meters per second"
          className="h-8 w-20 rounded-md border border-border bg-bg px-2 font-mono text-sm text-fg transition-colors hover:border-border-strong focus:border-accent focus:outline-none"
        />
        <span className="font-mono text-xs text-subtle">m/s</span>
      </label>
    </div>
  );
}
