import { getManualSwitchDestination } from './accountSwitchingSemantics'
import type { Rule } from './ruleSemantics'

type Effect = () => void | Promise<void>
type Navigate = (url: string) => void | Promise<void>
type LoadRules = () => Promise<Rule[]>
type SwitchAccount = (accountName: string) => Promise<void>

type ManualSwitchOptions = {
  accountName: string
  currentUrl: string
  loadRules: LoadRules
  switchAccount: SwitchAccount
  reload: Effect
  navigate: Navigate
}

export async function completeManualSwitch(options: ManualSwitchOptions) {
  const { accountName, currentUrl, loadRules, switchAccount, reload, navigate } = options

  await switchAccount(accountName)

  const rules = await loadRules()
  const destination = getManualSwitchDestination(currentUrl, rules)
  if (destination.kind === 'reload') {
    await reload()
    return
  }

  await navigate(destination.url)
}
