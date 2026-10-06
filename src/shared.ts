import browser from 'webextension-polyfill'

export { isGitHubUrl, isNormalGitHubUrl } from './services/ruleSemantics'

export async function removeAccount(account: string) {
  await browser.runtime.sendMessage({ type: 'removeAccount', account })
}
