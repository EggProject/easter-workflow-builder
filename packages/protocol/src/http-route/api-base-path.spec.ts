import { describe, expect, it } from 'vitest';
import { API_BASE_PATH } from './api-base-path.ts';

describe('API_BASE_PATH', () => {
  it('értéke "/api"', () => {
    expect(API_BASE_PATH).toBe('/api');
  });
});
