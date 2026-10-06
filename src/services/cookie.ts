import browser from 'webextension-polyfill'
import { CookieStoreContext, withStoreId } from './cookieStoreContext'

const COOKIE_URL = 'https://github.com'

async function get(name: string, context: CookieStoreContext = {}) {
  return browser.cookies.get(withStoreId({ url: COOKIE_URL, name }, context.storeId))
}

async function getAll(context: CookieStoreContext = {}) {
  return browser.cookies.getAll(withStoreId({ url: COOKIE_URL }, context.storeId))
}

async function clear(context: CookieStoreContext = {}) {
  const cookies = await getAll(context)
  for (const cookie of cookies) {
    await browser.cookies.remove(
      withStoreId({ url: COOKIE_URL, name: cookie.name }, context.storeId),
    )
  }
}

export default {
  get,
  getAll,
  clear,
}
