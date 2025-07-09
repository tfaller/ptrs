import type { Config } from 'jest';
import { createDefaultPreset } from "ts-jest";

const tsJestTransformCfg = createDefaultPreset({
  diagnostics: {
    ignoreCodes: ["TS151001"],
  },
}).transform

const config: Config = {
  testEnvironment: "jsdom",
  transform: {
    ...tsJestTransformCfg,
  },
}

export default config