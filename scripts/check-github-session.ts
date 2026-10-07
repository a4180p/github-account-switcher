import assert from 'node:assert/strict'
import { completeManualSwitch, startAddAccountLogin } from '../src/services/accountSwitching'

type CookieDetails = { url: string; name?: string; storeId?: string; value?: string }
const calls: { operation: string; details: CookieDetails }[] = []
const targetStore = 'firefox-container-1'
const sourceStore = 'firefox-container-2'
const savedCookie = {
  name: 'dotcom_user',
  value: 'sample_account',
  domain: 'github.com',
  path: '/',
  hostOnly: true,
  secure: true,
  httpOnly: false,
  session: true,
  storeId: sourceStore,
  expirationDate: undefined as number | undefined,
}
const jars: Record<string, (typeof savedCookie)[]> = {
  'firefox-default': [{ ...savedCookie, value: 'default_account', storeId: 'firefox-default' }],
  [targetStore]: [{ ...savedCookie, value: 'previous_account', storeId: targetStore }],
  [sourceStore]: [savedCookie],
}
const data: Record<string, unknown> = { accounts: { sample_account: [savedCookie] } }
let rejectWrite = false
const browserMock = {
  runtime: { id: 'session-check' },
  cookies: {
    get: async (details: CookieDetails) => {
      calls.push({ operation: 'get', details })
      return (
        jars[details.storeId ?? 'firefox-default'].find((cookie) => cookie.name === details.name) ??
        null
      )
    },
    getAll: async (details: CookieDetails) => {
      calls.push({ operation: 'getAll', details })
      return [...jars[details.storeId ?? 'firefox-default']]
    },
    remove: async (details: CookieDetails) => {
      calls.push({ operation: 'remove', details })
      const storeId = details.storeId ?? 'firefox-default'
      jars[storeId] = jars[storeId].filter((cookie) => cookie.name !== details.name)
    },
    set: async (details: CookieDetails) => {
      if (rejectWrite) throw new Error('Cookie write failed')
      calls.push({ operation: 'set', details })
      const storeId = details.storeId ?? 'firefox-default'
      jars[storeId].push({ ...savedCookie, ...details, storeId })
    },
  },
  storage: {
    local: {
      get: async (key: string) => ({ [key]: data[key] }),
      set: async (values: Record<string, unknown>) => {
        Object.assign(data, values)
      },
    },
  },
  action: {
    setBadgeText: async () => {},
    setBadgeBackgroundColor: async () => {},
    setBadgeTextColor: async () => {},
  },
}
Object.assign(globalThis, { chrome: browserMock, browser: browserMock })
const session = await import('../src/services/githubSession')

let destination: string | undefined
await startAddAccountLogin({
  currentUrl: 'https://github.com/sample/project',
  clearCookies: () => session.clearSession({ storeId: targetStore }),
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
assert.equal(jars[targetStore].length, 0)
assert.equal(jars['firefox-default'][0].value, 'default_account')
assert.deepEqual(jars[sourceStore], [savedCookie])

calls.length = 0
let reloaded = false
await completeManualSwitch({
  accountName: 'sample_account',
  currentUrl: 'https://github.com/sample/project',
  switchAccount: (name) => session.switchAccount(name, { storeId: targetStore }),
  loadRules: async () => [],
  reload: () => {
    reloaded = true
  },
  navigate: () => assert.fail('Expected reload'),
})
assert.equal(reloaded, true)
assert.deepEqual(
  calls.map(({ operation }) => operation),
  ['getAll', 'set'],
)
assert.ok(calls.every(({ details }) => details.storeId === targetStore))
assert.equal(jars[targetStore][0].value, 'sample_account')
assert.deepEqual(jars[sourceStore], [savedCookie])

jars[targetStore] = [
  { ...savedCookie, value: 'captured_account', storeId: targetStore },
  {
    ...savedCookie,
    name: 'user_session',
    value: 'sample_session',
    expirationDate: 2000000000,
    storeId: targetStore,
  },
]
calls.length = 0
assert.equal(await session.captureCurrentAccount({ storeId: targetStore }), 'captured_account')
assert.ok(calls.every(({ details }) => details.storeId === targetStore))
assert.equal(
  await session.getCookieHeader('captured_account'),
  'dotcom_user=captured_account; user_session=sample_session',
)
assert.equal(await session.getCookieHeader('missing_account'), null)
await session.saveAvatar('captured_account', 'https://avatars.githubusercontent.com/u/42')
const accounts = await session.listAccounts({ storeId: targetStore })
assert.deepEqual(
  accounts.find(({ active }) => active),
  {
    name: 'captured_account',
    active: true,
    avatarUrl: 'https://avatars.githubusercontent.com/u/42',
    expiresAt: new Date(2000000000000),
  },
)
assert.ok(accounts.every((account) => !('cookies' in account)))
assert.deepEqual(await session.listAccountNames(), ['sample_account', 'captured_account'])
assert.equal(await session.captureCurrentAccount({ storeId: sourceStore }), undefined)

const originalFetch = globalThis.fetch
const originalError = console.error
let errorLogged = false
try {
  Object.assign(globalThis, {
    fetch: async () => ({ status: 200, url: 'https://avatars.githubusercontent.com/u/43' }),
  })
  assert.equal(await session.syncAvatar('captured_account'), true)
  Object.assign(globalThis, { fetch: async () => ({ status: 404 }) })
  assert.equal(await session.syncAvatar('captured_account'), false)
  Object.assign(globalThis, {
    fetch: async () => {
      throw new Error('Network failed')
    },
  })
  console.error = () => {
    errorLogged = true
  }
  assert.equal(await session.syncAvatar('captured_account'), false)
  assert.equal(errorLogged, true)
} finally {
  globalThis.fetch = originalFetch
  console.error = originalError
}
assert.equal(
  (await session.listAccounts({ storeId: targetStore }))[1].avatarUrl,
  'https://avatars.githubusercontent.com/u/43',
)
await session.removeAccount('captured_account')
assert.deepEqual(await session.listAccountNames(), ['sample_account'])

calls.length = 0
await session.clearSession()
assert.ok(calls.every(({ details }) => details.storeId === undefined))
await session.switchAccount('sample_account')
assert.equal(calls.at(-1)?.details.storeId, undefined)
assert.equal(jars['firefox-default'][0].value, 'sample_account')

rejectWrite = true
reloaded = false
await assert.rejects(
  completeManualSwitch({
    accountName: 'sample_account',
    currentUrl: 'https://github.com/sample/project',
    switchAccount: (name) => session.switchAccount(name, { storeId: targetStore }),
    loadRules: async () => [],
    reload: () => {
      reloaded = true
    },
    navigate: () => assert.fail('Must not navigate after a failed switch'),
  }),
  /Cookie write failed/,
)
assert.equal(reloaded, false)

console.log('GitHub session capture, switching, and avatar sync OK')
