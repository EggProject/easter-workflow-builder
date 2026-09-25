import { Resizable, ResizableHandle, ResizablePanel } from '@easter-workflow-builder/ui';
import type { ReactElement, ReactNode } from 'react';

export interface RunViewTranscriptSideProperties {
  /**
   * A jóváhagyás panel (`ApprovalPromptPanel`). Mindig átadódik: látott
   * jóváhagyás nélkül is rajzolhat betöltés jelzést vagy hibaüzenetet.
   */
  readonly approvalPanel: ReactNode;
  /**
   * Igaz, ha van látott jóváhagyás (`useApprovalSelection`): ekkor a panel
   * a húzható elválasztó fölötti panelben áll.
   */
  readonly isApprovalShown: boolean;
  readonly transcriptPanel: ReactNode;
  /**
   * A két panel kezdő aránya százalékban; a perzisztálás a hívó dolga
   * (`run-view-approval-layout.ts`).
   */
  readonly defaultSizes: readonly number[];
  readonly onSizesChange: (sizes: readonly number[]) => void;
}

/**
 * A futás nézet transcript oldala: a jóváhagyás panel és a transcript,
 * közöttük a design system `Resizable` elemének függőleges, húzható
 * elválasztójával (user döntés 2026-09-25, SPEC-008 8. szekció 1. pont,
 * 10. szekció). Mindhárom reszponzív sávban ugyanez áll: a két osztott sávban
 * a transcript panelen, a fül sávban a "Transcript" fülön.
 *
 * **Az elválasztó csak látott jóváhagyás mellett áll.** Jóváhagyás nélkül
 * (a legtöbb futás) a transcript a teljes oldalt kapja; a jóváhagyás lista
 * betöltés jelzése és hibaüzenete ilyenkor a transcript fölött, a saját
 * magasságán áll, ugyanúgy, mint az elválasztó előtt.
 *
 * **A transcript panel sosem szerel le a jóváhagyások miatt.** A két alak
 * ugyanazt a fát rajzolja, a jóváhagyás panel és az elválasztó helye csak
 * üres (`false`) gyerek, tehát a transcript mindkét alakban ugyanazon a
 * helyen áll, és a React megtartja az állapotát (görgetés, kinyitott sorok,
 * követés; <https://react.dev/learn/preserving-and-resetting-state#same-component-at-the-same-position-preserves-state>).
 * Ha az elválasztó megjelenésekor egy másik fa épülne, egy élőben érkező
 * jóváhagyás a transcriptet a tetejére vagy az aljára rántaná. Egyedül álló
 * transcript panelnél a `run-view.css` adja a teljes magasságot, mert a
 * `ResizablePanel` inline `flex-basis` értéke a tárolt arány.
 */
export function RunViewTranscriptSide(properties: Readonly<RunViewTranscriptSideProperties>): ReactElement {
  const { approvalPanel, isApprovalShown, transcriptPanel, defaultSizes, onSizesChange } = properties;

  return (
    <Resizable direction="vertical" defaultSizes={defaultSizes} onSizesChange={onSizesChange}>
      {isApprovalShown && <ResizablePanel index={0}>{approvalPanel}</ResizablePanel>}
      {isApprovalShown && <ResizableHandle beforeIndex={0} aria-label="A jóváhagyás és a transcript aránya" />}
      <ResizablePanel index={1}>
        <div className="run-view-screen__transcript-content">
          {!isApprovalShown && approvalPanel}
          {transcriptPanel}
        </div>
      </ResizablePanel>
    </Resizable>
  );
}
