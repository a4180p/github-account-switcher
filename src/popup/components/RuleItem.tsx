import { Close, Done, Edit } from '@mui/icons-material'
import { Box, IconButton, TextField, Tooltip } from '@mui/material'
import { useState } from 'react'
import { Rule, validateAccount, validateRule, validateUrlPattern } from '../../services/rule'

type Props = {
  initialValue?: Rule
  mode?: 'view' | 'edit'
  onDone: (rule: Rule) => void
  onDelete: (rule: Rule) => void
}

export default function RuleItem(props: Props) {
  const { initialValue, mode, onDone, onDelete } = props
  const [rule, setRule] = useState<Rule>(
    initialValue ?? { id: Date.now(), urlPattern: '', account: '' },
  )
  const [isEditing, setIsEditing] = useState(mode === 'edit')
  const [urlPatternValidation, setUrlPatternValidation] = useState<string>()
  const [accountValidation, setAccountValidation] = useState<string>()

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
          size="medium"
          variant="standard"
          fullWidth
          placeholder="GitHub account"
          error={!!accountValidation}
          helperText={accountValidation}
          value={rule.account}
          onChange={handleAccountChange}
          disabled={!isEditing}
        />
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
