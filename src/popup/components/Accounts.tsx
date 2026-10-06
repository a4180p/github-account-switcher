import { Close, Login, PersonAdd } from '@mui/icons-material'
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  Tooltip,
  styled,
} from '@mui/material'
import { useEffect, useState } from 'react'
import browser, { Tabs } from 'webextension-polyfill'
import accountService, { Account } from '../../services/account'
import { completeManualSwitch, startAddAccountLogin } from '../../services/accountSwitching'
import cookie from '../../services/cookie'
import rule from '../../services/rule'
import { isGitHubUrl, removeAccount } from '../../shared'

const StyledBadge = styled(Badge)(({ theme }) => ({
  '& .MuiBadge-badge': {
    backgroundColor: '#44b700',
    color: '#44b700',
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    '&::after': {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      animation: 'ripple 1.2s infinite ease-in-out',
      border: '1px solid currentColor',
      content: '""',
    },
  },
  '@keyframes ripple': {
    '0%': {
      transform: 'scale(.8)',
      opacity: 1,
    },
    '100%': {
      transform: 'scale(2.4)',
      opacity: 0,
    },
  },
}))

function GitHubAvatar({ account }: { account: Account }) {
  const { name, active } = account
  const avatarUrl = account.avatarUrl ?? `https://github.com/${name}.png?size=100`
  const avatar = <Avatar src={avatarUrl} />

  if (active) {
    return (
      <StyledBadge
        overlap="circular"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        variant="dot"
      >
        {avatar}
      </StyledBadge>
    )
  }
  return avatar
}

async function getCurrentTab(): Promise<Tabs.Tab | undefined> {
  const queryOptions = { active: true, lastFocusedWindow: true }
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  const [tab] = await browser.tabs.query(queryOptions)
  return tab
}

function getGitHubTabAdapter(tab: Tabs.Tab | undefined) {
  const currentUrl = tab?.url
  if (!currentUrl || !isGitHubUrl(currentUrl) || !tab?.id) {
    return
  }

  return {
    currentUrl,
    storeId: tab.cookieStoreId,
    loadRules: () => rule.getAll(),
    navigate: async (url: string) => {
      await browser.tabs.update(tab.id!, { url })
    },
    reload: () => browser.tabs.reload(tab.id!),
  }
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])

  useEffect(() => {
    getCurrentTab().then((tab) => {
      accountService.getAll({ storeId: tab?.cookieStoreId }).then(setAccounts)
    })
  }, [])

  async function handleLogin() {
    const adapter = getGitHubTabAdapter(await getCurrentTab())

    if (adapter) {
      await startAddAccountLogin({
        currentUrl: adapter.currentUrl,
        loadRules: adapter.loadRules,
        clearCookies: () => cookie.clear({ storeId: adapter.storeId }),
        navigate: adapter.navigate,
      })
    } else {
      await cookie.clear()
      await browser.tabs.create({ url: 'https://github.com/login' })
    }

    window.close()
  }

  async function handleSwitch(username: string) {
    const adapter = getGitHubTabAdapter(await getCurrentTab())

    if (adapter) {
      await completeManualSwitch({
        accountName: username,
        currentUrl: adapter.currentUrl,
        loadRules: adapter.loadRules,
        switchAccount: (accountName) =>
          accountService.switchTo(accountName, { storeId: adapter.storeId }),
        reload: adapter.reload,
        navigate: adapter.navigate,
      })
    } else {
      await accountService.switchTo(username)
      await browser.tabs.create({ url: 'https://github.com' })
    }

    window.close()
  }

  async function handleRemove(accountName: string) {
    await removeAccount(accountName)
    setAccounts(accounts.filter((account) => account.name !== accountName))
  }

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        You can manage your logged in accounts here.
      </Alert>
      <Box sx={{ mb: 1 }}>
        <List dense disablePadding>
          {accounts.map((account, i) => (
            <ListItem key={account.name} disableGutters divider={i !== accounts.length - 1}>
              <ListItemAvatar>
                <GitHubAvatar account={account} />
              </ListItemAvatar>
              <ListItemText
                primary={account.name}
                secondary={account.expiresAt && `Expires at ${account.expiresAt.toLocaleString()}`}
              />
              <ListItemSecondaryAction>
                <Tooltip title={`Switch to ${account.name}`}>
                  <span>
                    <IconButton
                      color="primary"
                      disabled={account.active}
                      onClick={() => handleSwitch(account.name)}
                    >
                      <Login />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip
                  title={`Remove ${account.name}`}
                  onClick={() => handleRemove(account.name)}
                >
                  <IconButton color="warning">
                    <Close />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Box>
      <Button
        variant="contained"
        sx={{ textTransform: 'none' }}
        startIcon={<PersonAdd />}
        onClick={handleLogin}
      >
        Login Another Account
      </Button>
    </Box>
  )
}
