import type { Fact, ServerToolDescriptor } from '@easter-workflow-builder/provider-capability';
import { notMeasuredOnFlash } from '../measurement-gap/not-measured-on-flash.ts';

// A szerver oldali eszközök elérhetősége a Flash-re nem mért; a motor konzervatívan nem tilt (SPEC-004 11.2).
export const minimaxServerTools: Fact<readonly ServerToolDescriptor[]> = notMeasuredOnFlash(['M-17', 'M-25']);
