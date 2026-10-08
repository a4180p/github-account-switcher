import { Close, Done, DragIndicator, Edit } from '@mui/icons-material'
import { Box, IconButton, MenuItem, TextField, Tooltip } from '@mui/material'
import { useState, type DragEventHandler } from 'react'
import {
  IGNORE_ACCOUNT,
  Rule,
  validateAccount,
  validateRule,
  validateUrlPattern,
} from '../../services/rule'

type Props = {
  accounts: string[]
  draggable?: boolean
  disabled?: boolean
  initialValue?: Rule
  mode?: 'view' | 'edit'
  onDone: (rule: Rule) => void | Promise<boolean>
  onDelete: (rule: Rule) => void | Promise<boolean>
  onDragEnd?: DragEventHandler<HTMLButtonElement>
  onDragOver?: DragEventHandler<HTMLDivElement>
  onDragStart?: DragEventHandler<HTMLButtonElement>
  onDrop?: DragEventHandler<HTMLDivElement>
}

export default function RuleItem(props: Props) {
  const {
    accounts,
    draggable,
    disabled = false,
    initialValue,
    mode,
    onDone,
    onDelete,
    onDragEnd,
    onDragOver,
    onDragStart,
    onDrop,
  } = props
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

  async function handleDone() {
    if (!validate()) {
      return
    }
    if ((await onDone(rule)) !== false) {
      setIsEditing(false)
    }
  }

  async function handleDelete() {
    if ((await onDelete(rule)) !== false) {
      setIsEditing(false)
    }
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
    <Box
      sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <Box sx={{ flex: 1 }}>
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
          disabled={disabled || !isEditing}
        />
      </Box>
      <Box sx={{ width: 150, flexShrink: 0 }}>
        <TextField
          select
          size="medium"
          variant="standard"
          fullWidth
          error={!!accountValidation}
          helperText={accountValidation}
          value={rule.account}
          onChange={handleAccountChange}
          disabled={disabled || !isEditing}
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
      <Box sx={{ display: 'flex', flexShrink: 0 }}>
        {draggable && !disabled && !isEditing && (
          <Tooltip title="Reorder">
            <IconButton
              size="small"
              sx={{ cursor: 'grab' }}
              draggable
              onDragEnd={onDragEnd}
              onDragStart={onDragStart}
            >
              <DragIndicator />
            </IconButton>
          </Tooltip>
        )}
        {!isEditing && (
          <Tooltip title="Edit">
            <IconButton size="small" color="primary" disabled={disabled} onClick={handleEdit}>
              <Edit />
            </IconButton>
          </Tooltip>
        )}
        {isEditing && (
          <Tooltip title="Done">
            <IconButton size="small" color="primary" disabled={disabled} onClick={handleDone}>
              <Done />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Delete">
          <IconButton size="small" color="warning" disabled={disabled} onClick={handleDelete}>
            <Close />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}
