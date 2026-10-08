import browser, { type Runtime } from 'webextension-polyfill'
import type { RequestMessage, Response } from '../types'
import { RESOURCE_TYPES } from './requestRules'
import {
  autoSwitchRequest,
  handleCookieChange,
  handleMessage,
  interceptRequest,
  syncAccounts,
} from './runtime'

async function init() {
  await syncAccounts()

  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      void autoSwitchRequest(details.url, details.cookieStoreId).catch((error) => {
        console.error('Auto switch failed', error)
      })
    },
    { urls: ['https://github.com/*'], types: ['main_frame'] },
  )
  browser.cookies.onChanged.addListener(handleCookieChange)
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

  if (!browser.declarativeNetRequest) {
    browser.webRequest.onBeforeSendHeaders.addListener(
      interceptRequest,
      { urls: ['https://github.com/*'], types: RESOURCE_TYPES },
      ['blocking', 'requestHeaders'],
    )
  }

  /*
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    console.info('onRuleMatchedDebug', info)
  })*/
}

init()
