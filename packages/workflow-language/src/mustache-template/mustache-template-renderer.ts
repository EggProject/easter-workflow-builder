import type { OutcomeWithErrorType } from '@easter-workflow-builder/core';

/**
 * A Mustache sablon renderelő két művelete, a motor `TemplateRendererPort`
 * portjának alakjában (SPEC-010 3.1, 6.2). A csomag a motortól nem függ, ezért
 * az alakot itt deklarálja; a két típus szerkezeti egyezését a bekötés helye,
 * az `apps/server` ellenőrzi. A hibaág a tartalék mondatnál a kivétel
 * típusnevét is hordozza (`OutcomeWithErrorType`, SPEC-010 O-22); a szerver ezt
 * naplózza, a motor portja `Outcome`-ként kapja.
 */
export interface MustacheTemplateRenderer {
  readonly compile: (template: string) => OutcomeWithErrorType<void>;
  readonly render: (template: string, context: unknown) => OutcomeWithErrorType<string>;
}
