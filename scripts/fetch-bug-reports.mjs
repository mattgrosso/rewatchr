// Show UNRESOLVED in-app bug reports, newest first (--all for everything).
//
//   yarn fetch-bug-reports
//   yarn fetch-bug-reports --all
//
// Mark one done with `yarn resolve-bug-report <id>`.
//
// Reads through the Firebase CLI, not the Admin SDK: the bugReports node is
// write-only under the rules, and the CLI's project-owner login bypasses them
// with no service-account key to keep out of git. Needs `firebase login` to
// be valid; says so plainly if not.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const PROJECT = 'rewatchr-85473'
const PATH = '/bugReports'
const showAll = process.argv.includes('--all')

let data
try {
  const { stdout } = await run('firebase', ['database:get', PATH, '--project', PROJECT], {
    maxBuffer: 32 * 1024 * 1024,
  })
  data = JSON.parse(stdout || 'null')
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error('The `firebase` CLI is not on PATH.')
  } else {
    console.error('Could not read bug reports. Is `firebase login` still valid?')
    console.error(String(error.stderr || error.message).trim())
  }
  process.exit(1)
}

if (!data) {
  console.log('No bug reports yet.')
  process.exit(0)
}

const allEntries = Object.entries(data).sort(
  ([, a], [, b]) => (b.createdAt || b.clientCreatedAt || 0) - (a.createdAt || a.clientCreatedAt || 0),
)
const entries = showAll ? allEntries : allEntries.filter(([, report]) => !report.resolved)
const resolvedCount = allEntries.length - allEntries.filter(([, r]) => !r.resolved).length

if (!entries.length) {
  console.log(`No unresolved bug reports (${resolvedCount} resolved — rerun with --all to see them).`)
  process.exit(0)
}

console.log(`${entries.length} report${entries.length === 1 ? '' : 's'}\n`)

for (const [id, report] of entries) {
  const when = new Date(report.createdAt || report.clientCreatedAt || 0).toLocaleString()
  console.log(`── ${id}`)
  console.log(`   ${when}`)
  console.log(`   ${report.transcript}`)
  if (report.state) console.log(`   state: ${report.state}`)
  console.log(`   ${report.userAgent || ''} ${report.viewport || ''}`)
  console.log('')
}

process.exit(0)
