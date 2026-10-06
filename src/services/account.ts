import browser, { Cookies } from 'webextension-polyfill'
import { setBadgeText } from './badge'
import cookie from './cookie'
import { CookieStoreContext, withStoreId } from './cookieStoreContext'
import storage from './storage'

type Cookie = Cookies.Cookie
export type Account = {
  name: string
  cookies: Cookie[]
  active: boolean
  avatarUrl?: string
  expiresAt?: Date
}

type Accounts = Record<string, Cookie[]>

async function getStoredAccounts() {
  return (await storage.get<Accounts>('accounts')) ?? {}
}

async function getAll(context: CookieStoreContext = {}): Promise<Account[]> {
  const accounts = await getStoredAccounts()
  const currentAccount = await browser.cookies.get(
    withStoreId(
      {
        url: 'https://github.com',
        name: 'dotcom_user',
      },
      context.storeId,
    ),
  )

  const avatarUrls = await storage.get<Record<string, string>>('avatars')

  return Object.entries(accounts).map(([name, cookies]) => {
    const userSessionCookie = cookies.find(({ name }) => name === 'user_session')
    return {
      name,
      cookies,
      active: currentAccount?.value === name,
      avatarUrl: avatarUrls?.[name],
      expiresAt: userSessionCookie?.expirationDate
        ? new Date(userSessionCookie.expirationDate * 1000)
        : undefined,
    }
  })
}

async function getAllNames(): Promise<string[]> {
  return Object.keys(await getStoredAccounts())
}

async function find(accountName: string): Promise<Account | undefined> {
  const accounts = await getStoredAccounts()
  const cookies = accounts[accountName]
  if (!cookies) {
    return
  }

  const userSessionCookie = cookies.find(({ name }) => name === 'user_session')
  const avatarUrls = await storage.get<Record<string, string>>('avatars')
  return {
    name: accountName,
    cookies,
    active: false,
    avatarUrl: avatarUrls?.[accountName],
    expiresAt: userSessionCookie?.expirationDate
      ? new Date(userSessionCookie.expirationDate * 1000)
      : undefined,
  }
}

async function upsert(accountName: string, cookies: Cookie[]) {
  await storage.update<Accounts>('accounts', (accounts = {}) => {
    accounts[accountName] = cookies
    return accounts
  })
}

async function switchTo(accountName: string, context: CookieStoreContext = {}) {
  await cookie.clear(context)

  const account = await find(accountName)
  const cookies = account?.cookies || []
  for (const cookie of cookies) {
    const { hostOnly, domain, session, storeId, ...rest } = cookie
    await browser.cookies.set({
      url: 'https://github.com',
      domain: hostOnly ? undefined : domain,
      storeId: context.storeId,
      ...rest,
    })
  }

  if (cookies.length) {
    setBadgeText(accountName.slice(0, 2))
  } else {
    setBadgeText('...')
  }
}

async function remove(accountName: string) {
  await storage.update<Accounts>('accounts', (accounts) => {
    if (!accounts) {
      return
    }

    delete accounts[accountName]
    return accounts
  })
}

async function saveAvatar(accountName: string, avatarUrl: string) {
  await storage.update<Record<string, string>>('avatars', (avatars = {}) => {
    avatars[accountName] = avatarUrl
    return avatars
  })
}

export default {
  getAll,
  getAllNames,
  find,
  upsert,
  switchTo,
  remove,
  saveAvatar,
}
