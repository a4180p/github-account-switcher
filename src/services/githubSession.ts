import browser, { type Cookies } from 'webextension-polyfill'
import { setBadgeText } from './badge'
import { type CookieStoreContext, withStoreId } from './cookieStoreContext'
import storage from './storage'

export type Account = {
  name: string
  active: boolean
  avatarUrl?: string
  expiresAt?: Date
}

type Accounts = Record<string, Cookies.Cookie[]>
const COOKIE_URL = 'https://github.com'

async function getStoredAccounts() {
  return (await storage.get<Accounts>('accounts')) ?? {}
}

async function getCookies(context: CookieStoreContext) {
  return browser.cookies.getAll(withStoreId({ url: COOKIE_URL }, context.storeId))
}

export async function captureCurrentAccount(context: CookieStoreContext = {}) {
  const usernameCookie = await browser.cookies.get(
    withStoreId({ url: COOKIE_URL, name: 'dotcom_user' }, context.storeId),
  )
  const sessionCookie = await browser.cookies.get(
    withStoreId({ url: COOKIE_URL, name: 'user_session' }, context.storeId),
  )

  if (!usernameCookie || !sessionCookie || !usernameCookie.value) {
    return
  }

  const cookies = await getCookies(context)
  await storage.update<Accounts>('accounts', (accounts = {}) => {
    accounts[usernameCookie.value] = cookies
    return accounts
  })
  return usernameCookie.value
}

export async function listAccounts(context: CookieStoreContext = {}): Promise<Account[]> {
  const accounts = await getStoredAccounts()
  const currentAccount = await browser.cookies.get(
    withStoreId({ url: COOKIE_URL, name: 'dotcom_user' }, context.storeId),
  )
  const avatarUrls = await storage.get<Record<string, string>>('avatars')

  return Object.entries(accounts).map(([name, cookies]) => {
    const userSessionCookie = cookies.find(({ name }) => name === 'user_session')
    return {
      name,
      active: currentAccount?.value === name,
      avatarUrl: avatarUrls?.[name],
      expiresAt: userSessionCookie?.expirationDate
        ? new Date(userSessionCookie.expirationDate * 1000)
        : undefined,
    }
  })
}

export async function listAccountNames(): Promise<string[]> {
  return Object.keys(await getStoredAccounts())
}

export async function clearSession(context: CookieStoreContext = {}) {
  const cookies = await getCookies(context)
  for (const cookie of cookies) {
    await browser.cookies.remove(
      withStoreId({ url: COOKIE_URL, name: cookie.name }, context.storeId),
    )
  }
}

export async function switchAccount(accountName: string, context: CookieStoreContext = {}) {
  await clearSession(context)

  const accounts = await getStoredAccounts()
  const cookies = accounts[accountName] ?? []
  for (const cookie of cookies) {
    const { hostOnly, domain, session, storeId, ...rest } = cookie
    await browser.cookies.set({
      url: COOKIE_URL,
      domain: hostOnly ? undefined : domain,
      storeId: context.storeId,
      ...rest,
    })
  }

  await setBadgeText(cookies.length ? accountName.slice(0, 2) : '...')
}

export async function getCookieHeader(accountName: string): Promise<string | null> {
  const accounts = await getStoredAccounts()
  const cookies = accounts[accountName]
  return cookies?.length
    ? cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
    : null
}

export async function removeAccount(accountName: string) {
  await storage.update<Accounts>('accounts', (accounts) => {
    if (!accounts) {
      return
    }

    delete accounts[accountName]
    return accounts
  })
}

export async function saveAvatar(accountName: string, avatarUrl: string) {
  await storage.update<Record<string, string>>('avatars', (avatars = {}) => {
    avatars[accountName] = avatarUrl
    return avatars
  })
}

export async function syncAvatar(accountName: string) {
  try {
    const res = await fetch(`https://github.com/${accountName}.png?size=100`)
    if (res.status !== 200) {
      return false
    }

    await saveAvatar(accountName, res.url)
    return true
  } catch (error) {
    console.error('Failed to sync avatar', error)
    return false
  }
}
