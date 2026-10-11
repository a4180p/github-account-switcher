import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('../', import.meta.url))
const branch = execFileSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8' }).trim()
assert.equal(branch, 'main', 'Switch to main before releasing')
const status = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' }).trim()
assert.equal(status, '', 'Commit or stash local changes before releasing')

execFileSync('npm', ['version', 'patch'], { cwd, stdio: 'inherit' })
execFileSync('git', ['push', 'origin', 'main', '--follow-tags'], { cwd, stdio: 'inherit' })
