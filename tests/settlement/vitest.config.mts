import { defineConfig, mergeConfig } from 'vitest/config';
import base from '../../vitest.config';

export default mergeConfig(
  base,
  defineConfig({
    test: { include: ['tests/settlement/webhook.native.ts'], fileParallelism: false, testTimeout: 20_000 },
  }),
);
