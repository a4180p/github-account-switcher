import { AddCircle } from '@mui/icons-material'
import { Alert, Box, Button, Link } from '@mui/material'
import { useEffect, useSyncExternalStore } from 'react'
import ruleEditor from '../ruleEditor'
import RuleItem from './RuleItem'

export default function AutoSwitchRules() {
  const { rules, accounts, isAdding, isPending, error } = useSyncExternalStore(
    ruleEditor.subscribe,
    ruleEditor.getSnapshot,
  )

  useEffect(() => {
    void ruleEditor.load()
  }, [])

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        When the request URL path matches the regular expression, the account will be switched to
        the specified account automatically,{' '}
        <Link
          href="https://github.com/yuezk/github-account-switcher#auto-switching"
          target="_blank"
        >
          see help
        </Link>
        .
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          '& > :last-child': {
            mb: 2,
          },
        }}
      >
        {rules.map((rule) => (
          <RuleItem
            key={rule.id}
            accounts={accounts}
            draggable={!isAdding && !isPending}
            disabled={isPending}
            initialValue={rule}
            onDone={ruleEditor.updateRule}
            onDelete={ruleEditor.removeRule}
            onDragEnd={ruleEditor.endDrag}
            onDragOver={(event) => event.preventDefault()}
            onDragStart={(event) => {
              event.dataTransfer.setData('text/plain', String(rule.id))
              event.dataTransfer.effectAllowed = 'move'
              ruleEditor.startDrag(rule.id)
            }}
            onDrop={(event) => {
              event.preventDefault()
              void ruleEditor.moveRule(rule.id)
            }}
          />
        ))}
        {isAdding && (
          <RuleItem
            accounts={accounts}
            disabled={isPending}
            mode="edit"
            onDone={ruleEditor.addRule}
            onDelete={ruleEditor.stopAdding}
          />
        )}
      </Box>

      <Button
        variant="contained"
        startIcon={<AddCircle />}
        onClick={ruleEditor.startAdding}
        disabled={isAdding || isPending}
        sx={{ textTransform: 'none' }}
      >
        Add a Rule
      </Button>
    </Box>
  )
}
