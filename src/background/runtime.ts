import type { Cookies, WebRequest } from 'webextension-polyfill'
import { setBadgeText } from '../services/badge'
import { resolveStoreId } from '../services/cookieStoreContext'
import {
  captureCurrentAccount,
  clearSession,
  listAccountNames,
  listAccounts,
  removeAccount,
  saveAvatar,
  switchAccount,
  syncAvatar,
} from '../services/githubSession'
import ruleService, { findRuleForRequest, IGNORE_ACCOUNT } from '../services/rule'
import type { RequestMessage } from '../types'
import { buildCookieValue, updateDynamicRequestRules } from './requestRules'

export async function syncAccounts(storeId?: string) {
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

export async function handleMessage(message: RequestMessage, senderStoreId?: string) {
  const storeId = resolveStoreId(message.cookieStoreId, senderStoreId)
  switch (message.type) {
    case 'getAccounts':
      return listAccountNames()
    case 'switchAccount':
      return switchAccount(message.account, { storeId })
    case 'removeAccount':
      await removeAccount(message.account)
      await updateDynamicRequestRules()
      return
    case 'clearCookies':
      return clearSession({ storeId })
    case 'getAutoSwitchRules':
      return ruleService.getAll()
    case 'saveAvatar':
      return saveAvatar(message.account, message.avatarUrl)
  }
}

export async function handleCookieChange(changeInfo: Cookies.OnChangedChangeInfoType) {
  const { cookie, removed } = changeInfo
  if (cookie.name !== 'dotcom_user') {
    return
  }

  if (removed) {
    console.info('dotcom_user cookie removed')
    await setBadgeText('...')
    return
  }

  console.info('New dotcom_user cookie', cookie.value)
  await syncAccounts(cookie.storeId)
}

export async function autoSwitchRequest(url: string, cookieStoreId?: string) {
  const autoSwitchRules = await ruleService.getAll()
  const rule = findRuleForRequest(url, autoSwitchRules)
  if (!rule || rule.account === IGNORE_ACCOUNT) {
    return
  }

  console.log('onBeforeRequest: found an auto switch rule for url', url, rule)
  await switchAccount(rule.account, { storeId: cookieStoreId })
}

export async function interceptRequest(
  details: WebRequest.OnBeforeSendHeadersDetailsType,
): Promise<WebRequest.BlockingResponse> {
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
}
