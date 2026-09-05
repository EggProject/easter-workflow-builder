import { SandboxConfigSchema, type SandboxConfig } from '@easter-workflow-builder/protocol';
import { Checkbox } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { JsonTextAreaField } from './JsonTextAreaField.tsx';

const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  enabled: true,
  failIfUnavailable: false,
  autoAllowBashIfSandboxed: false,
  excludedCommands: [],
  enableWeakerNestedSandbox: false,
};

export interface SandboxFieldProperties {
  readonly value: SandboxConfig | null;
  readonly onChange: (nextValue: SandboxConfig | null) => void;
}

/**
 * A `sandbox` mező vezérlője (SPEC-008 5.2 "eszközök és környezet"
 * csoport). A `SandboxConfig` öt kötelező mezője mellett öt, kimondottan
 * `unknown` és elhagyható mezőt is hordoz (`packages/protocol/src/
 * node-config/sandbox-config.ts` doksija: "tippelni tilos, a pontos
 * alakjuk lezárása külön mérést igényel"), ezért nyers JSON szerkesztőn
 * megy, nem tíz bespoke mezőn. A `SandboxConfigSchema.safeParse` dönt arról,
 * hogy a beírt JSON valóban `SandboxConfig` alakú-e; amíg nem az, a
 * szerkesztett mező nem jut vissza a szülőhöz (a `JsonTextAreaField` a
 * begépelt szöveget helyben, elvesztés nélkül mutatja).
 */
export function SandboxField(properties: Readonly<SandboxFieldProperties>): ReactElement {
  const { value, onChange } = properties;
  const isEnabled = value !== null;

  return (
    <div className="field">
      <Checkbox
        label="Sandbox felülírás megadva"
        checked={isEnabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          // eslint-disable-next-line unicorn/no-null -- a `SandboxConfig | null` mező `null` értéke jelenti a "nincs felülírás" állapotot (SPEC-005 protokoll alak).
          onChange(event.target.checked ? DEFAULT_SANDBOX_CONFIG : null);
        }}
      />
      {isEnabled && (
        <JsonTextAreaField
          label="Sandbox beállítás (nyers JSON - öt mezője dokumentálatlan, unknown alakú)"
          value={value}
          onChange={(nextValue) => {
            const parsed = SandboxConfigSchema.safeParse(nextValue);
            if (parsed.success) {
              onChange(parsed.data);
            }
          }}
        />
      )}
    </div>
  );
}
