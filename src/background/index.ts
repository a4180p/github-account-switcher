import browser, { DeclarativeNetRequest, Runtime, WebRequest } from 'webextension-polyfill'
import accountService from '../services/account'
import { setBadgeText } from '../services/badge'
import cookie from '../services/cookie'
import { resolveStoreId } from '../services/cookieStoreContext'
import { captureCurrentAccount, listAccountNames, listAccounts } from '../services/githubSession'
import ruleService, {
  ACCOUNT_PARAM,
  findRuleForRequest,
  getRequestRulePattern,
  IGNORE_ACCOUNT,
} from '../services/rule'
import { RequestMessage, Response } from '../types'

const REQUEST_RULE_RESOURCE_TYPES: DeclarativeNetRequest.ResourceType[] = [
  'main_frame',
  'sub_frame',
  'csp_report',
  'websocket',
  'xmlhttprequest',
]

const WEB_REQUEST_RESOURCE_TYPES: WebRequest.ResourceType[] = [
  'main_frame',
  'sub_frame',
  'csp_report',
  'websocket',
  'xmlhttprequest',
]

async function syncAvatar(accountName: string) {
  try {
    const res = await fetch(`https://github.com/${accountName}.png?size=100`)
    if (res.status !== 200) {
      return false
    }

    await accountService.saveAvatar(accountName, res.url)
    return true
  } catch (error) {
    console.error('Failed to sync avatar', error)
    return false
  }
}

async function syncAccounts(storeId?: string) {
  const account = await captureCurrentAccount({ storeId })
  if (!account) {
    return
  }

  const accounts = await listAccounts({ storeId })
  console.info('synced accounts', accounts)

  await updateDynamicRequestRules()

  const avatarSynced = await syncAvatar(account)
  if (!avatarSynced) {
    console.info('Avatar sync skipped', account)
  }

  await setBadgeText(account.slice(0, 2))
}

async function removeAccount(accountName: string) {
  await accountService.remove(accountName)
  await updateDynamicRequestRules()
}

async function buildCookieValue(accountName: string): Promise<string | null> {
  const account = await accountService.find(accountName)
  const cookies = account?.cookies || []

  if (!cookies.length) {
    return null
  }

  return cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .concat(`${ACCOUNT_PARAM}=${accountName}`)
    .join('; ')
}

async function buildAddRules(): Promise<DeclarativeNetRequest.Rule[]> {
  const requestRules: DeclarativeNetRequest.Rule[] = []
  const autoSwitchRules = await ruleService.getAll()

  for (const [index, rule] of autoSwitchRules.entries()) {
    const cookieValue = await buildCookieValue(rule.account)
    if (!cookieValue) {
      continue
    }

    requestRules.push({
      id: index + 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          {
            header: 'Cookie',
            operation: 'set',
            value: cookieValue,
          },
        ],
      },
      condition: {
        regexFilter: getRequestRulePattern(rule),
        resourceTypes: REQUEST_RULE_RESOURCE_TYPES,
      },
    })
  }
  return requestRules
}

async function updateDynamicRequestRules() {
  if (!browser.declarativeNetRequest) {
    return
  }

  const existingRules = await browser.declarativeNetRequest.getDynamicRules()
  const removeRuleIds = existingRules.map((rule) => rule.id)
  const addRules = await buildAddRules()

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  })

  const rules = await browser.declarativeNetRequest.getDynamicRules()
  console.info('Current dynamic rules:', rules)
}

// Watch the requests, if the main_frame url matches any of the auto switch rules, switch to the account
function watchAutoSwitchRequests() {
  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      ruleService.getAll().then((autoSwitchRules) => {
        const rule = findRuleForRequest(details.url, autoSwitchRules)
        if (!rule || rule.account === IGNORE_ACCOUNT) {
          return
        }

        console.log('onBeforeRequest: found an auto switch rule for url', details.url, rule)
        accountService.switchTo(rule.account, { storeId: details.cookieStoreId })
      })
    },
    {
      urls: ['https://github.com/*'],
      types: ['main_frame'],
    },
  )
}

function watchCookies() {
  browser.cookies.onChanged.addListener(async (changeInfo) => {
    const { cookie, removed } = changeInfo
    // Ignore other cookies
    if (cookie.name !== 'dotcom_user') {
      return
    }

    if (removed) {
      if (cookie.name === 'dotcom_user') {
        console.info('dotcom_user cookie removed')
        await setBadgeText('...')
      }
      return
    }

    console.info('New dotcom_user cookie', cookie.value)
    await syncAccounts(cookie.storeId)
  })
}

function handleMessage(message: RequestMessage, senderStoreId?: string) {
  const { type } = message
  const storeId = resolveStoreId(message.cookieStoreId, senderStoreId)
  switch (type) {
    case 'getAccounts':
      return listAccountNames()
    case 'switchAccount':
      return accountService.switchTo(message.account, { storeId })
    case 'removeAccount':
      return removeAccount(message.account)
    case 'clearCookies':
      return cookie.clear({ storeId })
    case 'getAutoSwitchRules':
      return ruleService.getAll()
    case 'saveAvatar':
      return accountService.saveAvatar(message.account, message.avatarUrl)
  }
}

function listenMessage() {
  browser.runtime.onMessage.addListener(
    async (request: unknown, sender: Runtime.MessageSender): Promise<Response<unknown>> => {
      try {
        const data = await handleMessage(request as RequestMessage, sender.tab?.cookieStoreId)
        return { success: true, data }
      } catch (error: unknown) {
        return { success: false, error: error as Error }
      }
    },
  )
}

function interceptRequests() {
  browser.webRequest.onBeforeSendHeaders.addListener(
    async (details) => {
      if (!details.requestHeaders) {
        return { requestHeaders: details.requestHeaders }
      }

      const autoSwitchRules = await ruleService.getAll()
      const rule = findRuleForRequest(details.url, autoSwitchRules)
      if (!rule || rule.account === IGNORE_ACCOUNT) {
        return { requestHeaders: details.requestHeaders }
      }

      const cookieValue = await buildCookieValue(rule.account)
      if (cookieValue) {
        for (const header of details.requestHeaders) {
          if (header.name.toLowerCase() === 'cookie') {
            header.value = cookieValue
          }
        }
      }
      console.log('interceptRequests: found an auto switch rule for url', details.url, rule)
      return { requestHeaders: details.requestHeaders }
    },
    {
      urls: ['https://github.com/*'],
      types: WEB_REQUEST_RESOURCE_TYPES,
    },
    ['blocking', 'requestHeaders'],
  )
}

async function init() {
  await syncAccounts()

  watchAutoSwitchRequests()
  watchCookies()
  listenMessage()

  if (!browser.declarativeNetRequest) {
    interceptRequests()
  }

  /*
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    console.info('onRuleMatchedDebug', info)
  })*/
}

init()
