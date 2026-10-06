import accountService from './account'
import cookie from './cookie'
import type { CookieStoreContext } from './cookieStoreContext'

export async function captureCurrentAccount(context: CookieStoreContext = {}) {
  const usernameCookie = await cookie.get('dotcom_user', context)
  const sessionCookie = await cookie.get('user_session', context)

  if (!usernameCookie || !sessionCookie || !usernameCookie.value) {
    return
  }

  await accountService.upsert(usernameCookie.value, await cookie.getAll(context))
  return usernameCookie.value
}

export function listAccounts(context: CookieStoreContext = {}) {
  return accountService.getAll(context)
}

export function listAccountNames() {
  return accountService.getAllNames()
}
