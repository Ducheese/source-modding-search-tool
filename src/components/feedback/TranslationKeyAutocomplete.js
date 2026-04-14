import React from 'react';
import {
  Box,
  TextField,
  Typography,
  CircularProgress,
  Autocomplete,
  createFilterOptions,
} from '@mui/material';

/**
 * Translation key autocomplete component with custom rendering
 * @param {Object} props
 * @param {Array} props.keyOptions - Array of { key, value } options
 * @param {string|null} props.selectedKey - Currently selected key
 * @param {function} props.onChange - Callback when selection changes
 * @param {boolean} props.isLoading - Loading state
 * @param {boolean} props.error - Error state
 */
const TranslationKeyAutocomplete = ({ keyOptions, selectedKey, onChange, isLoading, error }) => {
  const filterOptions = createFilterOptions({ stringify: (opt) => `${opt.key} ${opt.value}` });

  return (
    <Autocomplete
      fullWidth
      options={keyOptions}
      value={keyOptions.find((opt) => opt.key === selectedKey) ?? null}
      onChange={(_, val) => onChange(val?.key ?? null)}
      loading={isLoading}
      disabled={isLoading || keyOptions.length === 0}
      filterOptions={filterOptions}
      getOptionLabel={(opt) => opt.key}
      isOptionEqualToValue={(opt, val) => opt.key === val.key}
      renderOption={(props, opt) => (
        <li {...props} key={opt.key}>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" fontWeight={500}>
              {opt.key}
            </Typography>
            {opt.value && (
              <Typography variant="caption" color="text.secondary">
                {opt.value.slice(0, 60)}
                {opt.value.length > 60 ? '…' : ''}
              </Typography>
            )}
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Search Translation Key"
          size="small"
          error={!!error}
          helperText={error ? 'Failed to load translation keys. Please try again.' : undefined}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isLoading && <CircularProgress size={16} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};

export default TranslationKeyAutocomplete;
