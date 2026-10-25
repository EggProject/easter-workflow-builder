import type { Outcome } from '@easter-workflow-builder/core';

/**
 * A Mustache sablon renderelő két művelete, a motor `TemplateRendererPort`
 * portjának alakjában (SPEC-010 3.1, 6.2). A csomag a motortól nem függ, ezért
 * az alakot itt deklarálja; a két típus szerkezeti egyezését a bekötés helye,
 * az `apps/server` ellenőrzi.
 */
export interface MustacheTemplateRenderer {
  readonly compile: (template: string) => Outcome<void>;
  readonly render: (template: string, context: unknown) => Outcome<string>;
}
