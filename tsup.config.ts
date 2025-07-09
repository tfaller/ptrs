import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['index.ts'],
    format: 'esm',
    splitting: false,
    minify: true,
    clean: true,
    dts: true,
    sourcemap: true,
})
