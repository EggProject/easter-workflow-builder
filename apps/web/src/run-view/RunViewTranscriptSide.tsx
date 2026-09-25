import { Resizable, ResizableHandle, ResizablePanel } from '@easter-workflow-builder/ui';
import type { ReactElement, ReactNode } from 'react';

export interface RunViewTranscriptSideProperties {
  /**
   * A jóváhagyás felület feje (`ApprovalPromptPanel`: az első betöltés
   * jelzése, a lista hibaüzenete és látott jóváhagyás mellett a lapozó).
   * Mindig átadódik, és mindig a transcript oldal tetején áll.
   */
  readonly approvalHeader: ReactNode;
  /**
   * A látott jóváhagyás görgethető törzse (`ApprovalPromptBody`); csak látott
   * jóváhagyás mellett rajzolódik ki.
   */
  readonly approvalBody: ReactNode;
  /**
   * A látott jóváhagyás tapadó akciósávja (`ApprovalDecisionActions`); csak
   * látott jóváhagyás mellett rajzolódik ki.
   */
  readonly approvalActions: ReactNode;
  /**
   * Igaz, ha van látott jóváhagyás (`useApprovalSelection`).
   */
  readonly isApprovalShown: boolean;
  readonly transcriptPanel: ReactNode;
  /**
   * A törzs és a transcript kezdő aránya százalékban; a perzisztálás a hívó
   * dolga (`run-view-approval-layout.ts`).
   */
  readonly defaultSizes: readonly number[];
  readonly onSizesChange: (sizes: readonly number[]) => void;
}

/**
 * A futás nézet transcript oldala: felül a jóváhagyás feje (a lapozó),
 * középen a design system `Resizable` elemének függőleges, húzható
 * elválasztójával a látott jóváhagyás törzse és a transcript, alul a döntés
 * tapadó akciósávja (SPEC-008 8. szekció 1. pont, 10. szekció). Mindhárom
 * reszponzív sávban ugyanez áll: a két osztott sávban a transcript panelen,
 * a fül sávban a "Transcript" fülön.
 *
 * **A lapozó és a gombsor a `Resizable` elemen KÍVÜL, fix helyen áll** (user
 * döntés 2026-09-25): csak a jóváhagyás szövege és a transcript osztozik a
 * húzható területen, tehát a lapozó és a két gomb az elválasztó bármely
 * állásában teljesen látszik. A sorrend a design system `drawer`
 * szerkezetét követi: a görgethető törzs FÖLÖTT a fej, ALATTA a tapadó
 * akciósáv felső elválasztóval; a transcript a törzzsel együtt a húzható
 * középső területen áll, ahogy egy CLI átirat alatt a döntés sora.
 *
 * **A fej és az akciósáv csak látott jóváhagyás mellett áll ki.** Jóváhagyás
 * nélkül (a legtöbb futás) a transcript a teljes oldalt kapja; a fejben
 * ilyenkor legfeljebb a lista betöltés jelzése vagy hibaüzenete áll, a
 * saját magasságán.
 *
 * **A transcript panel sosem szerel le a jóváhagyások miatt.** A két alak
 * ugyanazt a fát rajzolja: a fej, a `Resizable` és az akciósáv helye rögzített
 * gyerek pozíció, a törzs, az elválasztó és az akciósáv helye jóváhagyás
 * nélkül üres (`false`) gyerek, tehát a transcript mindkét alakban ugyanazon
 * a helyen áll, és a React megtartja az állapotát (görgetés, kinyitott
 * sorok, követés;
 * <https://react.dev/learn/preserving-and-resetting-state#same-component-at-the-same-position-preserves-state>).
 * Ha az elválasztó megjelenésekor egy másik fa épülne, egy élőben érkező
 * jóváhagyás a transcriptet a tetejére vagy az aljára rántaná. Egyedül álló
 * transcript panelnél a `run-view.css` adja a teljes magasságot, mert a
 * `ResizablePanel` inline `flex-basis` értéke a tárolt arány.
 */
export function RunViewTranscriptSide(properties: Readonly<RunViewTranscriptSideProperties>): ReactElement {
  const {
    approvalHeader,
    approvalBody,
    approvalActions,
    isApprovalShown,
    transcriptPanel,
    defaultSizes,
    onSizesChange,
  } = properties;

  return (
    <>
      {approvalHeader}
      <Resizable direction="vertical" defaultSizes={defaultSizes} onSizesChange={onSizesChange}>
        {isApprovalShown && <ResizablePanel index={0}>{approvalBody}</ResizablePanel>}
        {isApprovalShown && <ResizableHandle beforeIndex={0} aria-label="A jóváhagyás és a transcript aránya" />}
        <ResizablePanel index={1}>
          <div className="run-view-screen__transcript-content">{transcriptPanel}</div>
        </ResizablePanel>
      </Resizable>
      {isApprovalShown && approvalActions}
    </>
  );
}
