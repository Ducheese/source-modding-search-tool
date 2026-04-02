/**
 * GenericFeedbackForm.js
 * Configuration-driven feedback form component
 * Handles validation, character counting, and submission
 */

import React, { useState, useCallback } from 'react';
import { Box, TextField, Button, CircularProgress } from '@mui/material';
import { Send } from '@mui/icons-material';

/**
 * Field configuration type
 * @typedef {Object} FieldConfig
 * @property {string} name - Field identifier
 * @property {string} label - Display label
 * @property {string} placeholder - Placeholder text
 * @property {boolean} multiline - Whether it's a multiline input
 * @property {number} minRows - Minimum rows for multiline
 * @property {number} maxRows - Maximum rows for multiline
 * @property {number} maxLength - Maximum character length
 * @property {boolean} required - Whether field is required
 * @property {string} helperText - Additional helper text
 */

/**
 * Props for GenericFeedbackForm
 * @typedef {Object} GenericFeedbackFormProps
 * @property {Object.<string, FieldConfig>} fields - Field configurations
 * @property {string} submitLabel - Submit button label
 * @property {string} submitLoadingLabel - Submit button loading label
 * @property {function(Object): Promise<boolean>} onSubmit - Submit handler
 * @property {boolean} isSubmitting - Whether form is submitting
 */

/**
 * Character-counted text field component
 */
const CountedTextField = ({ value, max, ...props }) => {
  const count = value?.length || 0;
  const isOver = count > max;

  return (
    <TextField
      value={value}
      error={isOver || props.error}
      helperText={`${count}/${max}`}
      {...props}
      size="small"
    />
  );
};

/**
 * Generic feedback form with validation and character counting
 * @param {GenericFeedbackFormProps} props
 */
const GenericFeedbackForm = ({
  fields,
  submitLabel = 'Submit',
  submitLoadingLabel = 'Submitting...',
  onSubmit,
  isSubmitting,
}) => {
  // Initialize form state with empty values
  const [formData, setFormData] = useState(() => {
    const initialState = {};
    Object.keys(fields).forEach((key) => {
      initialState[key] = '';
    });
    return initialState;
  });

  const [touched, setTouched] = useState(() => {
    const initialState = {};
    Object.keys(fields).forEach((key) => {
      initialState[key] = false;
    });
    return initialState;
  });

  /**
   * Validate form fields
   * @returns {boolean} Whether form is valid
   */
  const validateForm = useCallback(() => {
    for (const [key, config] of Object.entries(fields)) {
      const value = formData[key];

      // Check required fields
      if (config.required && !value.trim()) {
        return false;
      }

      // Check max length
      if (config.maxLength && value.length > config.maxLength) {
        return false;
      }
    }
    return true;
  }, [formData, fields]);

  /**
   * Handle field value change
   */
  const handleChange = useCallback(
    (fieldName) => (e) => {
      setFormData((prev) => ({
        ...prev,
        [fieldName]: e.target.value,
      }));
    },
    []
  );

  /**
   * Handle field blur (mark as touched)
   */
  const handleBlur = useCallback((fieldName) => () => {
    setTouched((prev) => ({
      ...prev,
      [fieldName]: true,
    }));
  }, []);

  /**
   * Handle form submission
   */
  const handleFormSubmit = useCallback(
    async (e) => {
      e.preventDefault(); // Prevent default browser behavior
      if (!validateForm() || isSubmitting) return;

      // Trim all string values
      const trimmedData = {};
      for (const [key, value] of Object.entries(formData)) {
        trimmedData[key] = typeof value === 'string' ? value.trim() : value;
      }

      const success = await onSubmit(trimmedData);
      if (success) {
        // Reset form
        const resetState = {};
        const resetTouched = {};
        Object.keys(fields).forEach((key) => {
          resetState[key] = '';
          resetTouched[key] = false;
        });
        setFormData(resetState);
        setTouched(resetTouched);
      }
    },
    [formData, fields, validateForm, onSubmit, isSubmitting]
  );

  /**
   * Check if a field has error
   */
  const hasFieldError = useCallback(
    (fieldName) => {
      const config = fields[fieldName];
      const value = formData[fieldName];
      const fieldTouched = touched[fieldName];

      if (!fieldTouched) return false;

      if (config.required && !value.trim()) return true;
      if (config.maxLength && value.length > config.maxLength) return true;

      return false;
    },
    [formData, touched, fields]
  );

  const isValid = validateForm();

  return (
    <Box
      component="form"
      onSubmit={handleFormSubmit}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {Object.entries(fields).map(([key, config]) => (
        <CountedTextField
          key={key}
          label={config.label}
          value={formData[key]}
          onChange={handleChange(key)}
          onBlur={handleBlur(key)}
          error={hasFieldError(key)}
          multiline={config.multiline}
          minRows={config.minRows}
          maxRows={config.maxRows}
          max={config.maxLength}
          placeholder={config.placeholder}
          disabled={isSubmitting}
          fullWidth
          helperText={
            hasFieldError(key)
              ? config.required && !formData[key].trim()
                ? 'This field is required'
                : `Maximum ${config.maxLength} characters`
              : `${formData[key].length}/${config.maxLength}`
          }
        />
      ))}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          disabled={!isValid || isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : <Send />}
        >
          {isSubmitting ? submitLoadingLabel : submitLabel}
        </Button>
      </Box>
    </Box>
  );
};

export default GenericFeedbackForm;
