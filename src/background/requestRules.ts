import browser, { type DeclarativeNetRequest, type WebRequest } from 'webextension-polyfill'
import { getCookieHeader } from '../services/githubSession'
import ruleService, { ACCOUNT_PARAM, getRequestRulePattern } from '../services/rule'

export const RESOURCE_TYPES: (DeclarativeNetRequest.ResourceType & WebRequest.ResourceType)[] = [
  'main_frame',
  'sub_frame',
  'csp_report',
  'websocket',
  'xmlhttprequest',
]

export async function buildCookieValue(accountName: string): Promise<string | null> {
  const cookieHeader = await getCookieHeader(accountName)
  return cookieHeader ? `${cookieHeader}; ${ACCOUNT_PARAM}=${accountName}` : null
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
        requestHeaders: [{ header: 'Cookie', operation: 'set', value: cookieValue }],
      },
      condition: {
        regexFilter: getRequestRulePattern(rule),
        resourceTypes: RESOURCE_TYPES,
      },
    })
  }
  return requestRules
}

export async function updateDynamicRequestRules() {
  if (!browser.declarativeNetRequest) {
    return
  }

  const existingRules = await browser.declarativeNetRequest.getDynamicRules()
  const removeRuleIds = existingRules.map((rule) => rule.id)
  const addRules = await buildAddRules()

  await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules })
  const rules = await browser.declarativeNetRequest.getDynamicRules()
  console.info('Current dynamic rules:', rules)
}
