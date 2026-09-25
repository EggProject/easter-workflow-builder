import { Resizable, ResizableHandle, ResizablePanel } from '@easter-workflow-builder/ui';
import type { ReactElement, ReactNode } from 'react';

export interface RunViewTranscriptSideProperties {
  readonly transcriptPanel: ReactNode;
  /**
   * A látott jóváhagyás görgethető törzse (`ApprovalPromptBody`: a
   * figyelmeztetés, a cím, a szöveg és a `payload`); csak látott jóváhagyás
   * mellett rajzolódik ki.
   */
  readonly approvalBody: ReactNode;
  /**
   * A "Függő jóváhagyások" régió (`ApprovalPromptPanel`: az első betöltés
   * jelzése, a lista hibaüzenete, látott jóváhagyás mellett a lapozó és a
   * döntés akciósávja). Mindig átadódik, és mindig a transcript oldal alján
   * áll.
   */
  readonly approvalPanel: ReactNode;
  /**
   * Igaz, ha van látott jóváhagyás (`useApprovalSelection`).
   */
  readonly isApprovalShown: boolean;
  /**
   * A transcript és a jóváhagyás szövegének kezdő aránya százalékban, ebben a
   * sorrendben; a perzisztálás a hívó dolga (`run-view-approval-layout.ts`).
   */
  readonly defaultSizes: readonly number[];
  readonly onSizesChange: (sizes: readonly number[]) => void;
}

/**
 * A futás nézet transcript oldala, egy CLI engedélykérés sorrendjében (user
 * döntés 2026-09-25: "transcript felül, kérdés alul"): felül a transcript,
 * alatta a design system `Resizable` elemének függőleges, húzható
 * elválasztójával a látott jóváhagyás szövege, és közvetlenül alatta, a
 * `Resizable` elemen KÍVÜL, fix helyen a "Függő jóváhagyások" régió a
 * lapozóval és a döntés gombjaival (SPEC-008 8. szekció 1. pont, 10.). A
 * gombok így a kérdés alatt állnak, bármilyen arányon; a húzható területen
 * csak a transcript és a jóváhagyás szövege osztozik. Mindhárom reszponzív
 * sávban ugyanez áll: a két osztott sávban a transcript panelen, a fül sávban
 * a "Transcript" fülön.
 *
 * **Az elválasztó elsődleges panele a transcript** (W3C APG Window Splitter:
 * az érték és a név az elválasztó előtti, elsődleges panelé), ezért a neve
 * "A transcript és a jóváhagyás aránya", és az `aria-valuenow` a transcript
 * százaléka.
 *
 * **A jóváhagyás rész csak látott jóváhagyás mellett áll ki.** Jóváhagyás
 * nélkül (a legtöbb futás) a transcript a teljes oldalt kapja; a régióban
 * ilyenkor legfeljebb a lista betöltés jelzése vagy hibaüzenete áll, a saját
 * magasságán.
 *
 * **A transcript panel sosem szerel le a jóváhagyások miatt.** A transcript az
 * első gyerek pozíción áll, az elválasztó és a törzs helye jóváhagyás nélkül
 * üres (`false`) gyerek utána, tehát a transcript mindkét alakban ugyanazon a
 * helyen áll, és a React megtartja az állapotát (görgetés, kinyitott sorok,
 * követés;
 * <https://react.dev/learn/preserving-and-resetting-state#same-component-at-the-same-position-preserves-state>).
 * Ha az elválasztó megjelenésekor egy másik fa épülne, egy élőben érkező
 * jóváhagyás a transcriptet a tetejére vagy az aljára rántaná. Egyedül álló
 * transcript panelnél a `run-view.css` adja a teljes magasságot, mert a
 * `ResizablePanel` inline `flex-basis` értéke a tárolt arány.
 */
export function RunViewTranscriptSide(properties: Readonly<RunViewTranscriptSideProperties>): ReactElement {
  const { transcriptPanel, approvalBody, approvalPanel, isApprovalShown, defaultSizes, onSizesChange } = properties;

  return (
    <>
      <Resizable direction="vertical" defaultSizes={defaultSizes} onSizesChange={onSizesChange}>
        <ResizablePanel index={0}>
          <div className="run-view-screen__transcript-content">{transcriptPanel}</div>
        </ResizablePanel>
        {isApprovalShown && <ResizableHandle beforeIndex={0} aria-label="A transcript és a jóváhagyás aránya" />}
        {isApprovalShown && <ResizablePanel index={1}>{approvalBody}</ResizablePanel>}
      </Resizable>
      {approvalPanel}
    </>
  );
}
