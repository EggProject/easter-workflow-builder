import type { EnvironmentRequirement } from './environment-requirement.ts';

/**
 * Egy env követelmény elfogadott bemeneti nevei, elsőbbségi sorrendben (SPEC-013 4.4, 4.8):
 * `literal` és `process_env_passthrough` forrásnál egyedül a `name`, `process_env_alternatives`
 * forrásnál a `name`, utána az `alternativeNames`. A feloldás, a titok maszkolás, a sodródás
 * védelem és a provider lista ugyanezt a listát használja, hogy a nevek ne sodródjanak el.
 */
export function acceptedEnvironmentNames(requirement: EnvironmentRequirement): readonly [string, ...string[]] {
  switch (requirement.source) {
    case 'literal':
    case 'process_env_passthrough': {
      return [requirement.name];
    }
    case 'process_env_alternatives': {
      return [requirement.name, ...requirement.alternativeNames];
    }
  }
}
