import browser from 'webextension-polyfill'
import { completeManualSwitch, startAddAccountLogin } from '../services/accountSwitching'
import { removeAccount } from '../shared'
import {
  ClearCookiesMessage,
  GetAccountsMessage,
  GetAccountsResponse,
  GetAutoSwitchRulesMessage,
  GetAutoSwitchRulesResponse,
  SaveAvatarMessage,
} from '../types'
import './index.css'
// Script that will be injected in the main page
import { createElement } from './createElement'
import injectedScript from './injected?script&module'
import {
  ACCOUNT_ITEM_CLASS,
  ACCOUNT_REMOVE_CLASS,
  ADD_ACCOUNT_BUTTON_ID,
  createAccountItem,
  createAddAccountLink,
  createDivider,
} from './ui'

function getCurrentAvatarUrl(accountName: string) {
  return (
    document.querySelector<HTMLImageElement>('img.avatar-user')?.src ??
    document.querySelector<HTMLImageElement>(`img[alt="@${accountName}"]`)?.src
  )
}

async function syncCurrentAvatar() {
  const currentAccount = document.querySelector<HTMLMetaElement>('meta[name="user-login"]')?.content
  if (!currentAccount) {
    return
  }

  const avatarUrl = getCurrentAvatarUrl(currentAccount)
  if (!avatarUrl) {
    return
  }

  await browser.runtime.sendMessage({
    type: 'saveAvatar',
    account: currentAccount,
    avatarUrl,
  } as SaveAvatarMessage)
}

async function addSwitchUserMenu(logoutForm: HTMLFormElement) {
  const currentAccount = document.querySelector<HTMLMetaElement>('meta[name="user-login"]')?.content
  if (!currentAccount) {
    console.info('no current account found')
    return
  }

  await syncCurrentAvatar()

  if (!document.getElementById(ADD_ACCOUNT_BUTTON_ID)) {
    // Add the "Add another account" menu item and a divider
    const fragment = createElement('fragment', {
      children: [createAddAccountLink(), createDivider()],
    })

    // Insert the elements before the logoutForm
    logoutForm.parentElement?.insertBefore(fragment, logoutForm)
  }

  const res: GetAccountsResponse = await browser.runtime.sendMessage({
    type: 'getAccounts',
  } as GetAccountsMessage)

  if (!res?.success) {
    return
  }

  const { data: accounts } = res
  const addAccountButton = document.getElementById(ADD_ACCOUNT_BUTTON_ID)!
  for (const account of accounts) {
    if (account === currentAccount) {
      continue
    }

    const accountId = `${ACCOUNT_ITEM_CLASS}-${account}`
    if (!document.getElementById(accountId) && addAccountButton) {
      const accountWrapper = createAccountItem(account)
      addAccountButton.parentElement?.insertBefore(accountWrapper, addAccountButton)
    }
  }
}

async function getAutoSwitchRules() {
  const res: GetAutoSwitchRulesResponse = await browser.runtime.sendMessage({
    type: 'getAutoSwitchRules',
  } as GetAutoSwitchRulesMessage)

  return res?.success ? res.data : []
}

function navigateOnGitHub(path: string) {
  const url = new URL(path, window.location.origin)
  if (url.origin !== window.location.origin) {
    throw new Error('Unexpected redirect origin')
  }

  window.location.pathname = url.pathname
  window.location.search = url.search
}

function createGitHubPageAdapter() {
  return {
    currentUrl: window.location.href,
    loadRules: getAutoSwitchRules,
    clearCookies: async () => {
      await browser.runtime.sendMessage({ type: 'clearCookies' } as ClearCookiesMessage)
    },
    switchAccount: async (accountName: string) => {
      await browser.runtime.sendMessage({ type: 'switchAccount', account: accountName })
    },
    reload: () => window.location.reload(),
    navigate: (url: string) => {
      const nextUrl = new URL(url, window.location.origin)
      if (nextUrl.origin !== window.location.origin) {
        throw new Error('Unexpected redirect origin')
      }

      navigateOnGitHub(`${nextUrl.pathname}${nextUrl.search}`)
    },
  }
}

async function addAccount() {
  const adapter = createGitHubPageAdapter()
  await startAddAccountLogin({
    currentUrl: adapter.currentUrl,
    loadRules: adapter.loadRules,
    clearCookies: adapter.clearCookies,
    navigate: adapter.navigate,
  })
}

async function switchAccount(account: string) {
  const adapter = createGitHubPageAdapter()
  await completeManualSwitch({
    accountName: account,
    currentUrl: adapter.currentUrl,
    loadRules: adapter.loadRules,
    switchAccount: adapter.switchAccount,
    reload: adapter.reload,
    navigate: adapter.navigate,
  })
}

function injectScript() {
  const script = document.createElement('script')
  script.src = browser.runtime.getURL(injectedScript)
  script.type = 'module'
  document.head.prepend(script)
}

function ready(fn: () => void) {
  if (document.readyState !== 'loading') {
    fn()
    return
  }
  document.addEventListener('DOMContentLoaded', fn)
}

function watchDom() {
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const isOpen =
        mutation.type === 'attributes' &&
        mutation.attributeName === 'open' &&
        mutation.target instanceof HTMLElement &&
        mutation.target.hasAttribute('open')

      if (isOpen || (mutation.type === 'childList' && mutation.target instanceof HTMLElement)) {
        // Find the logout form on GitHub page or Gist page
        const logoutForm = mutation.target.querySelector<HTMLFormElement>(
          '.js-loggout-form, #user-links .logout-form, user-drawer-side-panel nav-list .ActionListItem:last-child',
        )
        if (logoutForm) {
          addSwitchUserMenu(logoutForm)
        }
      }
    }
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  })
}

async function init() {
  injectScript()
  ready(() => {
    syncCurrentAvatar()
    watchDom()
  })

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement

    if (target.closest(`.${ADD_ACCOUNT_BUTTON_ID}`)) {
      // add another account
      event.preventDefault()
      addAccount()
    } else if (target.closest(`.${ACCOUNT_ITEM_CLASS}`)) {
      // switch to account
      const closestTarget = target.closest(`.${ACCOUNT_ITEM_CLASS}`) as HTMLElement
      const { account } = closestTarget.dataset
      switchAccount(account!)
    } else if (target.closest(`.${ACCOUNT_REMOVE_CLASS}`)) {
      // remove account
      const btn = target.closest(`.${ACCOUNT_REMOVE_CLASS}`) as HTMLElement
      const { account } = btn.dataset
      removeAccount(account!).then(() => {
        btn.parentElement?.remove()
      })
    }
  })
}

init()
