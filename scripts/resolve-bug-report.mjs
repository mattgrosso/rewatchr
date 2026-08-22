// Marks one or more bug reports resolved, so fetch-bug-reports.mjs stops
// surfacing them by default.
//
//   yarn resolve-bug-report <reportId> [reportId...]
//
// Same CLI-based access as the fetcher (see its header).

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const PROJECT = 'rewatchr-85473'

const reportIds = process.argv.slice(2)
if (!reportIds.length) {
  console.error('Usage: yarn resolve-bug-report <reportId> [reportId...]')
  console.error('(report ids are printed by `yarn fetch-bug-reports`)')
  process.exit(1)
}

for (const id of reportIds) {
  try {
    await run('firebase', [
      'database:update',
      `/bugReports/${id}`,
      '--data',
      JSON.stringify({ resolved: true, resolvedAt: Date.now() }),
      '--project',
      PROJECT,
      '--force',
    ])
    console.log(`Marked ${id} resolved.`)
  } catch (error) {
    console.error(`Failed to resolve ${id}: ${String(error.stderr || error.message).trim()}`)
  }
}

process.exit(0)
