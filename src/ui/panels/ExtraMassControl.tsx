/**
 * ExtraMassControl — the Analyze-side panel for freeform extra mass.
 *
 * Wraps {@link ExtraMassFields} and wires it to the design store. The two
 * inputs — always-on **added mass** and loaded-only **extra payload** — feed
 * straight into the mass engine (`dryMass` picks up `added`, `loadedMass` adds
 * `payload`), so the TWR, acceleration, and mass panels all re-derive with the
 * extra weight included. Nothing here computes; it only reads/writes the store.
 */
import { useDesignStore } from '../../app/store/design-store';
import { Panel } from '../components/Panel';
import { IconScale } from '../components/icons';
import { ExtraMassFields } from './ExtraMassFields';

export function ExtraMassControl(): React.JSX.Element {
  const extraMass = useDesignStore((s) => s.extraMass);
  const setAddedMass = useDesignStore((s) => s.setAddedMass);
  const setExtraPayload = useDesignStore((s) => s.setExtraPayload);

  return (
    <Panel
      title="Extra mass"
      icon={<IconScale size={16} />}
      subtitle="Weight beyond the blocks & cargo"
    >
      <ExtraMassFields
        extraMass={extraMass}
        onAddedChange={setAddedMass}
        onPayloadChange={setExtraPayload}
      />
    </Panel>
  );
}
