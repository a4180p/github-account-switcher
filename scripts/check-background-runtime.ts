import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { Cookies, DeclarativeNetRequest, WebRequest } from 'webextension-polyfill'
import type { Response } from '../src/types'

async function check(mode: string) {
  const storeId = 'firefox-container-1'
  const cookie: Cookies.Cookie = {
    name: 'dotcom_user',
    value: 'sample_account',
    domain: 'github.com',
    path: '/',
    hostOnly: true,
    secure: true,
    httpOnly: false,
    sameSite: 'lax',
    session: true,
    storeId,
    firstPartyDomain: '',
  }
  const sessionCookie = { ...cookie, name: 'user_session', value: 'sample_session' }
  const rules = [
    { id: 1, urlPattern: '/docs/.+', account: 'ignore' },
    { id: 2, urlPattern: '/sample/.+', account: 'sample_account' },
  ]
  const data: Record<string, unknown> = {
    accounts: { sample_account: [cookie, sessionCookie] },
    rules,
  }
  const writes: Cookies.SetDetailsType[] = []
  const removals: Cookies.RemoveDetailsType[] = []
  const reads: (Cookies.GetDetailsType | Cookies.GetAllDetailsType)[] = []
  const badges: string[] = []
  const updates: DeclarativeNetRequest.UpdateDynamicRulesOptionsType[] = []
  let rejectWrite = false
  let onMessage:
    | ((
        request: unknown,
        sender: { tab?: { cookieStoreId?: string } },
      ) => Promise<Response<unknown>>)
    | undefined
  let onCookieChange: ((info: Cookies.OnChangedChangeInfoType) => Promise<void>) | undefined
  let onRequest: ((details: WebRequest.OnBeforeRequestDetailsType) => void) | undefined
  let onHeaders:
    | ((details: WebRequest.OnBeforeSendHeadersDetailsType) => Promise<WebRequest.BlockingResponse>)
    | undefined
  let headerOptions: string[] | undefined
  let resolveReady = () => {}
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })
  const browserMock = {
    runtime: {
      id: 'background-check',
      onMessage: {
        addListener(listener: typeof onMessage) {
          onMessage = listener
          resolveReady()
        },
      },
    },
    cookies: {
      get: async (details: Cookies.GetDetailsType) => {
        reads.push(details)
        if (details.storeId !== storeId) return null
        return details.name === 'dotcom_user' ? cookie : sessionCookie
      },
      getAll: async (details: Cookies.GetAllDetailsType) => {
        reads.push(details)
        return [cookie, sessionCookie]
      },
      remove: async (details: Cookies.RemoveDetailsType) => {
        removals.push(details)
      },
      set: async (details: Cookies.SetDetailsType) => {
        if (rejectWrite) throw new Error('Cookie write failed')
        writes.push(details)
        return cookie
      },
      onChanged: {
        addListener(listener: typeof onCookieChange) {
          onCookieChange = listener
        },
      },
    },
    storage: {
      local: {
        get: async (key: string) => structuredClone({ [key]: data[key] }),
        set: async (values: Record<string, unknown>) => {
          Object.assign(data, structuredClone(values))
        },
      },
    },
    action: {
      setBadgeText: async ({ text }: { text: string }) => {
        badges.push(text)
      },
      setBadgeBackgroundColor: async () => {},
      setBadgeTextColor: async () => {},
    },
    webRequest: {
      onBeforeRequest: {
        addListener(listener: typeof onRequest) {
          onRequest = listener
        },
      },
      onBeforeSendHeaders: {
        addListener(listener: typeof onHeaders, _filter: unknown, options: string[]) {
          onHeaders = listener
          headerOptions = options
        },
      },
    },
    ...(mode === 'declarative'
      ? {
          declarativeNetRequest: {
            getDynamicRules: async () => [{ id: 9 }],
            updateDynamicRules: async (
              options: DeclarativeNetRequest.UpdateDynamicRulesOptionsType,
            ) => {
              updates.push(options)
            },
          },
        }
      : {}),
  }
  Object.assign(globalThis, {
    chrome: browserMock,
    browser: browserMock,
    fetch: async () => ({ status: 404 }),
  })
  const runtime = await import('../src/background/runtime')
  await import('../src/background/index')
  await Promise.race([
    ready,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Listeners were not registered')), 3000).unref(),
    ),
  ])
  assert.ok(onMessage && onCookieChange && onRequest)
  assert.equal(Boolean(onHeaders), mode === 'blocking')
  if (mode === 'blocking') assert.deepEqual(headerOptions, ['blocking', 'requestHeaders'])

  await runtime.syncAccounts(storeId)
  assert.ok(
    reads.filter((details) => details.storeId).every((details) => details.storeId === storeId),
  )
  assert.equal(badges.at(-1), 'sa')
  if (mode === 'declarative') {
    assert.deepEqual(updates[0].removeRuleIds, [9])
    assert.equal(updates[0].addRules?.length, 1)
    assert.equal(updates[0].addRules?.[0].id, 2)
    assert.equal(
      updates[0].addRules?.[0].condition.regexFilter,
      '/sample/.+|__account__=sample_account',
    )
  } else assert.equal(updates.length, 0)

  assert.deepEqual(await onMessage({ type: 'getAccounts' }, {}), {
    success: true,
    data: ['sample_account'],
  })
  assert.deepEqual(await onMessage({ type: 'getAutoSwitchRules' }, {}), {
    success: true,
    data: rules,
  })
  await onMessage(
    {
      type: 'saveAvatar',
      account: 'sample_account',
      avatarUrl: 'https://avatars.githubusercontent.com/u/42',
    },
    {},
  )
  assert.deepEqual(data.avatars, { sample_account: 'https://avatars.githubusercontent.com/u/42' })
  await onMessage({ type: 'clearCookies' }, { tab: { cookieStoreId: storeId } })
  assert.ok(removals.every((details) => details.storeId === storeId))
  await onMessage(
    { type: 'switchAccount', account: 'sample_account', cookieStoreId: 'firefox-container-2' },
    { tab: { cookieStoreId: storeId } },
  )
  assert.ok(writes.every((details) => details.storeId === 'firefox-container-2'))

  writes.length = 0
  await runtime.autoSwitchRequest('https://github.com/docs/page', storeId)
  assert.equal(writes.length, 0)
  onRequest({
    requestId: 'sample-request',
    url: 'https://github.com/sample/project',
    method: 'GET',
    tabId: 1,
    frameId: 0,
    parentFrameId: -1,
    timeStamp: 0,
    type: 'main_frame',
    cookieStoreId: storeId,
    thirdParty: false,
  })
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.equal(writes.length, 2)
  assert.ok(writes.every((details) => details.storeId === storeId))

  if (onHeaders) {
    const details: WebRequest.OnBeforeSendHeadersDetailsType = {
      requestId: 'sample-request',
      url: 'https://github.com/sample/project',
      method: 'GET',
      tabId: 1,
      frameId: 0,
      parentFrameId: -1,
      timeStamp: 0,
      type: 'main_frame',
      cookieStoreId: storeId,
      thirdParty: false,
      requestHeaders: [
        { name: 'Cookie', value: 'old=value' },
        { name: 'Accept', value: 'text/html' },
      ],
    }
    const changed = await onHeaders(details)
    assert.equal(
      changed.requestHeaders?.[0].value,
      'dotcom_user=sample_account; user_session=sample_session; __account__=sample_account',
    )
    assert.equal(changed.requestHeaders?.[1].value, 'text/html')
    const untouched = [{ name: 'Cookie', value: 'old=value' }]
    assert.deepEqual(
      await onHeaders({
        ...details,
        url: 'https://github.com/docs/page',
        requestHeaders: untouched,
      }),
      { requestHeaders: untouched },
    )
    assert.deepEqual(await onHeaders({ ...details, requestHeaders: undefined }), {
      requestHeaders: undefined,
    })
  }

  const beforeReads = reads.length
  await onCookieChange({
    cookie: { ...cookie, name: 'other_cookie' },
    removed: false,
    cause: 'explicit',
  })
  assert.equal(reads.length, beforeReads)
  await onCookieChange({ cookie, removed: true, cause: 'explicit' })
  assert.equal(badges.at(-1), '...')
  await onCookieChange({ cookie, removed: false, cause: 'explicit' })
  assert.equal(badges.at(-1), 'sa')

  rejectWrite = true
  const failure = await onMessage(
    { type: 'switchAccount', account: 'sample_account' },
    { tab: { cookieStoreId: storeId } },
  )
  assert.equal(failure.success, false)
  if (!failure.success) assert.equal(failure.error.message, 'Cookie write failed')
  rejectWrite = false
  await onMessage({ type: 'removeAccount', account: 'sample_account' }, {})
  assert.deepEqual(data.accounts, {})
  if (mode === 'declarative') assert.deepEqual(updates.at(-1)?.addRules, [])
  console.log(`Background runtime ${mode} OK`)
}

const mode = process.argv[2]
if (mode) {
  assert.ok(mode === 'blocking' || mode === 'declarative')
  await check(mode)
} else {
  for (const requestMode of ['declarative', 'blocking']) {
    execFileSync(
      process.execPath,
      ['--import', 'tsx', fileURLToPath(import.meta.url), requestMode],
      { stdio: 'inherit' },
    )
  }
}
