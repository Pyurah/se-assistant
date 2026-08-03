/**
 * `cn` — conditional className joiner.
 *
 * A tiny, dependency-free `clsx`: joins truthy string/array args into a single
 * space-separated className. Keeps component markup readable when toggling
 * classes by state without pulling in a library.
 */
export type ClassValue = string | number | false | null | undefined | ClassValue[];

export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (Array.isArray(v)) {
      const nested = cn(...v);
      if (nested) out.push(nested);
    } else {
      out.push(String(v));
    }
  }
  return out.join(' ');
}
