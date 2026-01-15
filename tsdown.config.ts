import { defineConfig } from 'tsdown'
import builtins from 'builtin-modules'

export default defineConfig({
  entry: {
    main: 'src/main.ts',
  },
  format: 'cjs',
  target: 'es2023',
  outDir: '.',
  outputOptions: {
    entryFileNames: '[name].js',
  },
  clean: false,
  sourcemap: false,
  minify: true,
  treeshake: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtins,
  ],
})
