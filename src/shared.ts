import browser from 'webextension-polyfill'
import { Rule, getRuleAction } from './services/rule'

export function isGitHubUrl(url: string | undefined) {
  if (!url) {
    return false
  }

  return /^https:\/\/(.+?\.)?github\.com/.test(url)
}

export function isNormalGitHubUrl(url: string | undefined, rules: Rule[]) {
  if (!url) {
    return false
  }

  if (!isGitHubUrl(url)) {
    return false
  }

  return getRuleAction(url, rules) !== 'switch'
}

export async function removeAccount(account: string) {
  await browser.runtime.sendMessage({ type: 'removeAccount', account })
}
