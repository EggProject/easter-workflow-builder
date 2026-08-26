import type { EnvironmentRequirement } from '../capability/environment-requirement.ts';

// Az előfizetéses út a Claude Code bejelentkezésből veszi a hitelesítést, ezért nincs kötelező env változó.
export const claudeSubscriptionRequiredEnvironment: readonly EnvironmentRequirement[] = [];
