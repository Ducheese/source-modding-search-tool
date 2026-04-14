import React from 'react';
import {
  Box,
  Typography,
  Button,
  InputBase,
} from '@mui/material';
import { PersonOutline } from '@mui/icons-material';
import { MAX_LEN } from '../../config/feedbackConfig';
import { getContributorNicknameLength } from '../../utils/feedbackIdentity';

/**
 * Contributor identity field component
 * @param {Object} props
 * @param {string} props.anonymousId - Anonymous ID
 * @param {string} props.contributorNickname - Current nickname
 * @param {boolean} props.hasCustomContributorNickname - Whether using custom nickname
 * @param {function} props.onChange - Input change handler
 * @param {function} props.onBlur - Blur handler
 * @param {function} props.onReset - Reset to anonymous ID handler
 * @param {boolean} props.isSubmitting - Submission in progress
 */
const ContributorIdentityField = ({
  anonymousId,
  contributorNickname,
  hasCustomContributorNickname,
  onChange,
  onBlur,
  onReset,
  isSubmitting,
}) => {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
        gap: 2,
        alignItems: 'end',
      }}
    >
      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={600}
          sx={{ display: 'block', mb: 0.75 }}
        >
          Contributor Nickname
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
            pb: 0.5,
            transition: 'border-color 0.2s ease',
            '&:focus-within': {
              borderColor: 'primary.main',
            },
          }}
        >
          <PersonOutline
            sx={{
              fontSize: 18,
              color: 'text.secondary',
              flexShrink: 0,
            }}
          />

          <InputBase
            value={contributorNickname}
            onChange={onChange}
            onBlur={onBlur}
            disabled={isSubmitting}
            fullWidth
            placeholder={anonymousId}
            inputProps={{
              'aria-label': 'Contributor Nickname',
              spellCheck: false,
              autoCapitalize: 'off',
              autoCorrect: 'off',
            }}
            sx={{
              flex: 1,
              fontSize: 15,
              '& input': {
                p: 0,
                lineHeight: 1.8,
              },
            }}
          />

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0 }}
          >
            {getContributorNicknameLength(contributorNickname)}/{MAX_LEN.contributorNickname}
          </Typography>
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.75, display: 'block' }}
        >
          Saved locally and attached to every submission. Leave the default anonymous ID if you prefer privacy.
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: { xs: 'flex-start', sm: 'flex-end' },
          gap: 0.75,
          minWidth: { sm: 210 },
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Anonymous ID:{' '}
          <Box
            component="span"
            sx={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              color: 'text.primary',
            }}
          >
            {anonymousId}
          </Box>
        </Typography>

        <Typography
          variant="caption"
          color={hasCustomContributorNickname ? 'primary.main' : 'text.secondary'}
        >
          {hasCustomContributorNickname ? 'Using custom nickname' : 'Using anonymous ID'}
        </Typography>

        <Button
          variant="text"
          size="small"
          onClick={onReset}
          disabled={isSubmitting}
          sx={{
            minWidth: 0,
            px: 0,
            alignSelf: { xs: 'flex-start', sm: 'flex-end' },
            visibility: hasCustomContributorNickname ? 'visible' : 'hidden',
          }}
        >
          Use Anonymous ID
        </Button>
      </Box>
    </Box>
  );
};

export default ContributorIdentityField;
