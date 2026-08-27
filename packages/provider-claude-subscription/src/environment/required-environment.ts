import type { EnvironmentRequirement } from '@easter-workflow-builder/provider-capability';

// Az előfizetéses út a Claude Code bejelentkezésből veszi a hitelesítést, ezért nincs kötelező env változó.
export const claudeSubscriptionRequiredEnvironment: readonly EnvironmentRequirement[] = [];
