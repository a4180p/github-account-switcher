import { Close, Done, Edit } from '@mui/icons-material'
import { Box, IconButton, MenuItem, TextField, Tooltip } from '@mui/material'
import { useState } from 'react'
import {
  IGNORE_ACCOUNT,
  Rule,
  validateAccount,
  validateRule,
  validateUrlPattern,
} from '../../services/rule'

type Props = {
  accounts: string[]
  initialValue?: Rule
  mode?: 'view' | 'edit'
  onDone: (rule: Rule) => void
  onDelete: (rule: Rule) => void
}

export default function RuleItem(props: Props) {
  const { accounts, initialValue, mode, onDone, onDelete } = props
  const [rule, setRule] = useState<Rule>(
    initialValue ?? { id: Date.now(), urlPattern: '', account: '' },
  )
  const [isEditing, setIsEditing] = useState(mode === 'edit')
  const [urlPatternValidation, setUrlPatternValidation] = useState<string>()
  const [accountValidation, setAccountValidation] = useState<string>()

  const accountOptions = [...accounts]
  if (!accountOptions.includes(IGNORE_ACCOUNT)) {
    accountOptions.push(IGNORE_ACCOUNT)
  }
  if (rule.account && !accountOptions.includes(rule.account)) {
    accountOptions.unshift(rule.account)
  }

  function handleEdit() {
    setIsEditing(true)
  }

  function validate() {
    const validation = validateRule(rule)

    setUrlPatternValidation(validation.urlPatternMessage)
    setAccountValidation(validation.accountMessage)

    return validation.valid
  }

  function handleDone() {
    if (!validate()) {
      return
    }
    setIsEditing(false)
    onDone(rule)
  }

  function handleDelete() {
    setIsEditing(false)
    onDelete(rule)
  }

  function handleUrlPatternChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    const { message } = validateUrlPattern(value)
    setUrlPatternValidation(message)
    setRule({ ...rule, urlPattern: value })
  }

  function handleAccountChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    const { message } = validateAccount(value)
    setAccountValidation(message)
    setRule({ ...rule, account: value })
  }

  return (
    <Box display="flex" gap={2} alignItems="flex-start">
      <Box flex="1">
        <TextField
          size="medium"
          variant="standard"
          fullWidth
          placeholder="regular expression, e.g., /prefix-.+"
          error={!!urlPatternValidation}
          helperText={urlPatternValidation}
          value={rule.urlPattern}
          onChange={handleUrlPatternChange}
          autoFocus={isEditing}
          disabled={!isEditing}
        />
      </Box>
      <Box width={150} flexShrink={0}>
        <TextField
          select
          size="medium"
          variant="standard"
          fullWidth
          error={!!accountValidation}
          helperText={accountValidation}
          value={rule.account}
          onChange={handleAccountChange}
          disabled={!isEditing}
        >
          <MenuItem value="" disabled>
            Select account
          </MenuItem>
          {accountOptions.map((account) => (
            <MenuItem key={account} value={account}>
              {account === IGNORE_ACCOUNT ? 'ignore' : account}
            </MenuItem>
          ))}
        </TextField>
      </Box>
      <Box display="flex" flexShrink={0}>
        {!isEditing && (
          <Tooltip title="Edit">
            <IconButton size="small" color="primary" onClick={handleEdit}>
              <Edit />
            </IconButton>
          </Tooltip>
        )}
        {isEditing && (
          <Tooltip title="Done">
            <IconButton size="small" color="primary" onClick={handleDone}>
              <Done />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Delete">
          <IconButton size="small" color="warning" onClick={handleDelete}>
            <Close />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}
