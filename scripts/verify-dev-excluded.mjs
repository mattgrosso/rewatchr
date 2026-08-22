// Fails the build if the dev sign-in bypass reached the production bundle.
//
// The bypass (src/lib/devAuth.js) lets a browser open the app as a fake,
// local-only user with no password — exactly what you don't want shipped. It
// is safe by construction, because every reference to it sits behind
// `import.meta.env.DEV`, which Vite replaces with `false` when building; the
// branch and everything it reaches are then dropped.
//
// "Safe by construction" is a claim about a build tool's behaviour, though,
// and this is what checks the claim: it greps the actual shipped JavaScript
// for strings that exist only in the dev-only modules. Wired into `yarn
// deploy` ahead of the upload, so a refactor that accidentally makes
// devAuth.js reachable from production code can't be deployed.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'

// Strings that appear ONLY in src/lib/devAuth.js and src/lib/devSeed.js.
const FORBIDDEN = [
  'dev@rewatchr.local',
  'rewatchr.devAuth',
  'dev-local',
  'devAuthEnabled',
  'startDevSession',
  'maybeSeedDevPool',
]

const jsFiles = []
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (entry.name.endsWith('.js')) jsFiles.push(path)
  }
}

try {
  walk(DIST)
} catch {
  console.error(`No ${DIST}/ to check — run \`yarn build\` first.`)
  process.exit(1)
}

if (!jsFiles.length) {
  console.error(`No JavaScript found in ${DIST}/ — did the build succeed?`)
  process.exit(1)
}

const found = []
for (const file of jsFiles) {
  const source = readFileSync(file, 'utf8')
  for (const needle of FORBIDDEN) {
    if (source.includes(needle)) found.push(`${file}: ${needle}`)
  }
}

if (found.length) {
  console.error('The dev sign-in bypass is in the production bundle:\n')
  for (const hit of found) console.error(`  ${hit}`)
  console.error(
    '\nSomething now imports src/lib/devAuth.js (or devSeed.js) from code that',
  )
  console.error('ships. Reach it only from inside an `import.meta.env.DEV` branch.')
  process.exit(1)
}

console.log(`dev bypass excluded from ${jsFiles.length} bundled file(s) — safe to deploy.`)
