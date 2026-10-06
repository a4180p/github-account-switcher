export type Rule = {
  id: number
  urlPattern: string
  account: string
}

export const IGNORE_ACCOUNT = 'ignore'
export const ACCOUNT_PARAM = '__account__'

const MAX_URL_PATTERN_LENGTH = 500
const rulePatternCache = new Map<string, RegExp | null>()

type ValidationResult = {
  valid: boolean
  message?: string
}

type RuleValidationResult = {
  valid: boolean
  urlPatternMessage?: string
  accountMessage?: string
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

function getUnsafeRegexReason(regex: string) {
  if (regex.length > MAX_URL_PATTERN_LENGTH) {
    return 'Regular expression is too long'
  }

  if (/\((?:[^()\\]|\\.)*[+*{](?:[^()\\]|\\.)*\)[+*{]/.test(regex)) {
    return 'Regular expression is too complex'
  }
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

  const unsafeRegexReason = getUnsafeRegexReason(urlPattern)
  if (unsafeRegexReason) {
    return {
      valid: false,
      message: unsafeRegexReason,
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

export function validateRule(rule: Rule): RuleValidationResult {
  const urlPatternValidation = validateUrlPattern(rule.urlPattern)
  const accountValidation = validateAccount(rule.account)

  return {
    valid: urlPatternValidation.valid && accountValidation.valid,
    urlPatternMessage: urlPatternValidation.message,
    accountMessage: accountValidation.message,
  }
}

export function assertValidRule(rule: Rule) {
  const validation = validateRule(rule)
  if (validation.valid) {
    return
  }

  throw new Error(validation.urlPatternMessage ?? validation.accountMessage ?? 'Invalid rule')
}

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

function getRulePattern(rule: Rule): RegExp | undefined {
  const cachedPattern = rulePatternCache.get(rule.urlPattern)
  if (cachedPattern !== undefined) {
    return cachedPattern ?? undefined
  }

  if (!validateUrlPattern(rule.urlPattern).valid) {
    rulePatternCache.set(rule.urlPattern, null)
    return
  }

  const pattern = new RegExp(rule.urlPattern)
  rulePatternCache.set(rule.urlPattern, pattern)
  return pattern
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
