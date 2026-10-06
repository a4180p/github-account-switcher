export type Rule = {
  id: number
  urlPattern: string
  account: string
}

export const IGNORE_ACCOUNT = 'ignore'
export const ACCOUNT_PARAM = '__account__'

type ValidationResult = {
  valid: boolean
  message?: string
}

function isValidRegex(regex: string) {
  try {
    new RegExp(regex)
    return true
  } catch {
    return false
  }
}

function isValidGitHubAccount(account: string) {
  return /^(?![-_])(?!.*[-_]{2})[A-Za-z0-9_-]+(?<![-_])$/g.test(account)
}

export function validateUrlPattern(urlPattern: string): ValidationResult {
  if (urlPattern.trim() === '') {
    return {
      valid: false,
      message: 'URL pattern is required',
    }
  }

  if (!isValidRegex(urlPattern)) {
    return {
      valid: false,
      message: 'Invalid regular expression',
    }
  }

  return {
    valid: true,
  }
}

export function validateAccount(account: string): ValidationResult {
  if (account.trim() === '') {
    return {
      valid: false,
      message: 'Account is required',
    }
  }

  if (account === IGNORE_ACCOUNT) {
    return {
      valid: true,
    }
  }

  if (!isValidGitHubAccount(account)) {
    return {
      valid: false,
      message: 'Invalid account',
    }
  }

  return {
    valid: true,
  }
}

function getRulePattern(rule: Rule): RegExp | undefined {
  if (!validateUrlPattern(rule.urlPattern).valid) {
    return
  }

  return new RegExp(rule.urlPattern)
}

export function findMatchingRule(url: string, rules: Rule[]): Rule | undefined {
  for (const rule of rules) {
    const pattern = getRulePattern(rule)
    if (pattern?.test(url)) {
      return rule
    }
  }
}

function getTaggedAccount(url: string) {
  try {
    return new URL(url).searchParams.get(ACCOUNT_PARAM) ?? undefined
  } catch {
    return
  }
}

export function getRequestRulePattern(rule: Rule) {
  return `${rule.urlPattern}|${ACCOUNT_PARAM}=${rule.account}`
}

export function findRuleForRequest(url: string, rules: Rule[]): Rule | undefined {
  const taggedAccount = getTaggedAccount(url)
  if (taggedAccount) {
    return rules.find((rule) => rule.account === taggedAccount) ?? findMatchingRule(url, rules)
  }

  return findMatchingRule(url, rules)
}

export function isIgnoreRule(rule: Rule | undefined): rule is Rule {
  return rule?.account === IGNORE_ACCOUNT
}

export function getRuleAction(url: string, rules: Rule[]): 'none' | 'switch' | 'ignore' {
  const rule = findMatchingRule(url, rules)
  if (!rule) {
    return 'none'
  }

  return isIgnoreRule(rule) ? 'ignore' : 'switch'
}
