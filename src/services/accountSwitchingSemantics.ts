import { isNormalGitHubUrl, Rule } from './ruleSemantics'

const GITHUB_HOME_URL = 'https://github.com'
const GITHUB_HOME_PATH = '/'
const GITHUB_LOGIN_PATH = '/login'

type AccountSwitchDestination =
  | {
      kind: 'reload'
    }
  | {
      kind: 'navigate'
      url: string
    }

export function getAddAccountLoginPath(currentUrl: string, rules: Rule[]) {
  return isNormalGitHubUrl(currentUrl, rules)
    ? `${GITHUB_LOGIN_PATH}?return_to=${encodeURIComponent(currentUrl)}`
    : GITHUB_LOGIN_PATH
}

export function getAddAccountLoginDestination(currentUrl: string, rules: Rule[]) {
  return `${GITHUB_HOME_URL}${getAddAccountLoginPath(currentUrl, rules)}`
}

export function getManualSwitchDestination(
  currentUrl: string,
  rules: Rule[],
): AccountSwitchDestination {
  if (isNormalGitHubUrl(currentUrl, rules)) {
    return { kind: 'reload' }
  }

  return {
    kind: 'navigate',
    url: GITHUB_HOME_URL,
  }
}

export function getManualSwitchPath(currentUrl: string, rules: Rule[]) {
  const destination = getManualSwitchDestination(currentUrl, rules)
  return destination.kind === 'reload' ? undefined : GITHUB_HOME_PATH
}
