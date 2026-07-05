import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const appShell = 'dist/app/index.html';

if (!existsSync(appShell)) {
  throw new Error('Missing dist/app/index.html. Build the embedded app before generating app fallbacks.');
}

const appRoutes = [
  'about',
  'about/contact',
  'about/roadmap',
  'brainscan',
  'brief',
  'builds',
  'cast',
  'chetana',
  'confessions',
  'consulting',
  'dashgen',
  'demo',
  'device',
  'docs',
  'docs/api',
  'docs/architecture',
  'docs/getting-started',
  'docs/self-hosting',
  'ecosystem',
  'features',
  'hub',
  'id',
  'lab',
  'live',
  'mirror',
  'mirror-ambient',
  'mirror-beta',
  'mirrorseed',
  'platform',
  'preview',
  'pricing',
  'prism',
  'products',
  'products/agentdna',
  'products/chetana',
  'products/cognitive-dashboard',
  'products/glyphtrail',
  'products/kavach',
  'products/lingos',
  'products/mirrorbalance',
  'products/mirrorbrain',
  'products/mirrorgate',
  'products/mirrorrecall',
  'products/trustbydesign',
  'products/vault',
  'proof',
  'privacy',
  'reflect',
  'research',
  'scan',
  'setup',
  'skills',
  'start',
  'status',
  'terms',
  'trust',
  'twins',
  'use-cases',
  'enterprise',
  'use-cases/education',
  'use-cases/enterprise',
  'use-cases/government',
  'use-cases/healthcare',
  'use-cases/individuals',
  'use-cases/teams',
  'workspace',
];

copyFileSync(appShell, 'dist/404.html');

for (const route of appRoutes) {
  const target = join('dist/app', route, 'index.html');
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(appShell, target);
}

console.log(`Generated app shell fallbacks for ${appRoutes.length} app routes.`);
