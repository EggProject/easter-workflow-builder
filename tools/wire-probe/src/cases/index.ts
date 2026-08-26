/**
Az összes mérési eset típusos registrybe gyűjtve.
*/
import type { MeasurementCase } from '../harness/types.ts';
import { M01 } from './m-01.ts';
import { M02 } from './m-02.ts';
import { M03 } from './m-03.ts';
import { M04 } from './m-04.ts';
import { M05 } from './m-05.ts';
import { M06 } from './m-06.ts';
import { M07 } from './m-07.ts';
import { M08 } from './m-08.ts';
import { M09 } from './m-09.ts';
import { M10 } from './m-10.ts';
import { M11 } from './m-11.ts';
import { M12 } from './m-12.ts';
import { M13 } from './m-13.ts';
import { M14 } from './m-14.ts';
import { M15 } from './m-15.ts';
import { M16 } from './m-16.ts';
import { M17 } from './m-17.ts';
import { M18 } from './m-18.ts';
import { M19 } from './m-19.ts';
import { M20 } from './m-20.ts';
import { M21 } from './m-21.ts';
import { M22 } from './m-22.ts';
import { M23 } from './m-23.ts';
import { M24 } from './m-24.ts';
import { M25 } from './m-25.ts';
import { M26 } from './m-26.ts';
import { M27 } from './m-27.ts';
import { M28 } from './m-28.ts';
import { M29 } from './m-29.ts';
import { M30 } from './m-30.ts';
import { M31 } from './m-31.ts';
import { M32 } from './m-32.ts';
import { M33 } from './m-33.ts';
import { M34 } from './m-34.ts';
import { M35 } from './m-35.ts';
import { M36 } from './m-36.ts';

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
  'M-26': M26,
  'M-27': M27,
  'M-28': M28,
  'M-29': M29,
  'M-30': M30,
  'M-31': M31,
  'M-32': M32,
  'M-33': M33,
  'M-34': M34,
  'M-35': M35,
  'M-36': M36,
};

export const CASE_IDS: readonly string[] = Object.keys(CASE_REGISTRY);
