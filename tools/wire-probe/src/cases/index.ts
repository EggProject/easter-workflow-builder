/** Az összes mérési eset típusos registrybe gyűjtve. */
import type { MeasurementCase } from '../harness/types.ts';
import { M01 } from './M-01.ts';
import { M02 } from './M-02.ts';
import { M03 } from './M-03.ts';
import { M04 } from './M-04.ts';
import { M05 } from './M-05.ts';
import { M06 } from './M-06.ts';
import { M07 } from './M-07.ts';
import { M08 } from './M-08.ts';
import { M09 } from './M-09.ts';
import { M10 } from './M-10.ts';
import { M11 } from './M-11.ts';
import { M12 } from './M-12.ts';
import { M13 } from './M-13.ts';
import { M14 } from './M-14.ts';
import { M15 } from './M-15.ts';
import { M16 } from './M-16.ts';
import { M17 } from './M-17.ts';
import { M18 } from './M-18.ts';
import { M19 } from './M-19.ts';
import { M20 } from './M-20.ts';
import { M21 } from './M-21.ts';
import { M22 } from './M-22.ts';
import { M23 } from './M-23.ts';
import { M24 } from './M-24.ts';
import { M25 } from './M-25.ts';

export const CASE_REGISTRY: Readonly<Record<string, MeasurementCase>> = {
  'M-01': M01,
  'M-02': M02,
  'M-03': M03,
  'M-04': M04,
  'M-05': M05,
  'M-06': M06,
  'M-07': M07,
  'M-08': M08,
  'M-09': M09,
  'M-10': M10,
  'M-11': M11,
  'M-12': M12,
  'M-13': M13,
  'M-14': M14,
  'M-15': M15,
  'M-16': M16,
  'M-17': M17,
  'M-18': M18,
  'M-19': M19,
  'M-20': M20,
  'M-21': M21,
  'M-22': M22,
  'M-23': M23,
  'M-24': M24,
  'M-25': M25,
};

export const CASE_IDS: readonly string[] = Object.keys(CASE_REGISTRY);
