#!/usr/bin/env node
// Executa o CLI do Next garantindo que o patch de readlink (filesystems sem
// symlink) seja carregado tambem nos processos filhos, via NODE_OPTIONS.

const { spawnSync } = require('child_process');
const path = require('path');

// NODE_OPTIONS interpreta backslash como escape; usa barras normais
const patch = path.join(__dirname, 'fs-readlink-patch.cjs').replace(/\\/g, '/');
const nodeOptions = `${process.env.NODE_OPTIONS ?? ''} --require "${patch}"`.trim();

const result = spawnSync(
  process.execPath,
  [require.resolve('next/dist/bin/next'), ...process.argv.slice(2)],
  { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: nodeOptions } },
);

process.exit(result.status ?? 1);
