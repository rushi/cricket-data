#!/usr/bin/env npx zx
/** Builds the site and previews it at http://localhost:8000 */
import { $ } from 'zx/core';

$.verbose = true;

await $`node site.mjs`;
console.log('Serving at http://localhost:8000');
await $({ cwd: '_site' })`python3 -m http.server 8000`;
