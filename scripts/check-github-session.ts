import assert from 'node:assert/strict'
import { completeManualSwitch, startAddAccountLogin } from '../src/services/accountSwitching'

type CookieDetails = { url: string; name?: string; storeId?: string; value?: string }
const calls: { operation: string; details: CookieDetails }[] = []
const targetStore = 'firefox-container-1'
const savedCookie = {
  name: 'dotcom_user',
  value: 'sample_account',
  domain: 'github.com',
  path: '/',
  hostOnly: true,
  secure: true,
  httpOnly: false,
  session: true,
  storeId: 'firefox-container-2',
}
let rejectWrite = false
const browserMock = {
  runtime: { id: 'session-check' },
  cookies: {
    getAll: async (details: CookieDetails) => {
      calls.push({ operation: 'getAll', details })
      return [{ ...savedCookie, value: 'previous_account', storeId: details.storeId }]
    },
    remove: async (details: CookieDetails) => {
      calls.push({ operation: 'remove', details })
    },
    set: async (details: CookieDetails) => {
      if (rejectWrite) throw new Error('Cookie write failed')
      calls.push({ operation: 'set', details })
    },
  },
  storage: {
    local: {
      get: async (key: string) =>
        key === 'accounts' ? { accounts: { sample_account: [savedCookie] } } : {},
    },
  },
  action: {
    setBadgeText: async () => {},
    setBadgeBackgroundColor: async () => {},
    setBadgeTextColor: async () => {},
  },
}
Object.assign(globalThis, { chrome: browserMock, browser: browserMock })
const { clearSession, switchAccount } = await import('../src/services/githubSession')

let destination: string | undefined
await startAddAccountLogin({
  currentUrl: 'https://github.com/sample/project',
  clearCookies: () => clearSession({ storeId: targetStore }),
  loadRules: async () => [],
  navigate: (url) => {
    destination = url
  },
})
assert.equal(
  destination,
  'https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2Fsample%2Fproject',
)
assert.deepEqual(
  calls.map(({ operation }) => operation),
  ['getAll', 'remove'],
)
assert.ok(calls.every(({ details }) => details.storeId === targetStore))

calls.length = 0
let reloaded = false
await completeManualSwitch({
  accountName: 'sample_account',
  currentUrl: 'https://github.com/sample/project',
  switchAccount: (name) => switchAccount(name, { storeId: targetStore }),
  loadRules: async () => [],
  reload: () => {
    reloaded = true
  },
  navigate: () => assert.fail('Expected reload'),
})
assert.equal(reloaded, true)
assert.deepEqual(
  calls.map(({ operation }) => operation),
  ['getAll', 'remove', 'set'],
)
assert.ok(calls.every(({ details }) => details.storeId === targetStore))
assert.equal(calls[2].details.value, 'sample_account')

calls.length = 0
await clearSession()
assert.ok(calls.every(({ details }) => details.storeId === undefined))
await switchAccount('sample_account')
assert.equal(calls.at(-1)?.details.storeId, undefined)

rejectWrite = true
reloaded = false
await assert.rejects(
  completeManualSwitch({
    accountName: 'sample_account',
    currentUrl: 'https://github.com/sample/project',
    switchAccount: (name) => switchAccount(name, { storeId: targetStore }),
    loadRules: async () => [],
    reload: () => {
      reloaded = true
    },
    navigate: () => assert.fail('Must not navigate after a failed switch'),
  }),
  /Cookie write failed/,
)
assert.equal(reloaded, false)

console.log('GitHub session login and switching OK')
