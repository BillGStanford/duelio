'use strict';

if (process.platform !== 'win32') process.exit(0);

const fs = require('node:fs');
const file = require.resolve('next/dist/compiled/@vercel/og/index.node.js');
let source = fs.readFileSync(file, 'utf8');
let replacements = 0;

for (const target of [
  '../noto-sans-v27-latin-regular.ttf',
  '../yoga.wasm',
  '../resvg.wasm',
]) {
  const broken = `fileURLToPath(join(import.meta.url, "${target}"))`;
  const fixed = `fileURLToPath(new URL("./${target.slice(3)}", import.meta.url))`;
  const previousFix = `fileURLToPath(new URL("${target}", import.meta.url))`;
  if (source.includes(broken)) {
    source = source.replace(broken, fixed);
    replacements += 1;
  } else if (source.includes(previousFix)) {
    source = source.replace(previousFix, fixed);
    replacements += 1;
  } else if (!source.includes(fixed)) {
    throw new Error(`Cannot apply Windows image-renderer fix; expected ${target} in Next.js source.`);
  }
}

if (replacements > 0) fs.writeFileSync(file, source);
