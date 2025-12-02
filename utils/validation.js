/**
 * Validation utilities for Dongtube API
 * Provides common validation functions and async error handler
 */

/**
 * Validation helper object
 */
export const validate = {
  /**
   * Check if string is not empty
   * @param {string} str - String to validate
   * @returns {boolean}
   */
  notEmpty(str) {
    return typeof str === 'string' && str.trim().length > 0;
  },

  /**
   * Check if valid URL
   * @param {string} url - URL to validate
   * @param {string} domain - Optional domain to check (e.g., "tiktok.com")
   * @returns {boolean}
   */
  url(url, domain = null) {
    if (!this.notEmpty(url)) return false;
    
    try {
      const parsed = new URL(url);
      
      // Check if domain matches (if provided)
      if (domain) {
        return parsed.hostname.includes(domain);
      }
      
      // Check if valid http/https URL
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  },

  /**
   * Check if valid email
   * @param {string} email - Email to validate
   * @returns {boolean}
   */
  email(email) {
    if (!this.notEmpty(email)) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Check if valid number
   * @param {any} num - Value to check
   * @param {number} min - Optional minimum value
   * @param {number} max - Optional maximum value
   * @returns {boolean}
   */
  number(num, min = null, max = null) {
    const parsed = Number(num);
    if (isNaN(parsed)) return false;
    
    if (min !== null && parsed < min) return false;
    if (max !== null && parsed > max) return false;
    
    return true;
  },

  /**
   * Check if valid array with items
   * @param {any} arr - Array to validate
   * @param {number} minLength - Optional minimum length
   * @returns {boolean}
   */
  array(arr, minLength = 1) {
    return Array.isArray(arr) && arr.length >= minLength;
  },

  /**
   * Check if valid object with keys
   * @param {any} obj - Object to validate
   * @returns {boolean}
   */
  object(obj) {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && Object.keys(obj).length > 0;
  },

  /**
   * Check if value is in allowed list
   * @param {any} value - Value to check
   * @param {Array} allowed - Array of allowed values
   * @returns {boolean}
   */
  inArray(value, allowed) {
    return allowed.includes(value);
  },

  /**
   * Validate multiple fields at once
   * @param {Object} data - Object with data to validate
   * @param {Object} rules - Validation rules
   * @returns {Object} { valid: boolean, errors: Array }
   * 
   * @example
   * validate.fields(
   *   { url: 'https://tiktok.com/video/123', count: '5' },
   *   {
   *     url: { required: true, type: 'url', domain: 'tiktok.com' },
   *     count: { required: false, type: 'number', min: 1, max: 10 }
   *   }
   * )
   */
  fields(data, rules) {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];

      // Check required
      if (rule.required && !this.notEmpty(value)) {
        errors.push(`${field} is required`);
        continue;
      }

      // Skip validation if not required and empty
      if (!rule.required && !this.notEmpty(value)) {
        continue;
      }

      // Validate by type
      switch (rule.type) {
        case 'url':
          if (!this.url(value, rule.domain)) {
            errors.push(`${field} must be a valid URL${rule.domain ? ` from ${rule.domain}` : ''}`);
          }
          break;

        case 'email':
          if (!this.email(value)) {
            errors.push(`${field} must be a valid email`);
          }
          break;

        case 'number':
          if (!this.number(value, rule.min, rule.max)) {
            let msg = `${field} must be a valid number`;
            if (rule.min !== undefined && rule.max !== undefined) {
              msg += ` between ${rule.min} and ${rule.max}`;
            } else if (rule.min !== undefined) {
              msg += ` >= ${rule.min}`;
            } else if (rule.max !== undefined) {
              msg += ` <= ${rule.max}`;
            }
            errors.push(msg);
          }
          break;

        case 'array':
          if (!this.array(value, rule.minLength)) {
            errors.push(`${field} must be an array with at least ${rule.minLength || 1} items`);
          }
          break;

        case 'enum':
          if (!this.inArray(value, rule.values)) {
            errors.push(`${field} must be one of: ${rule.values.join(', ')}`);
          }
          break;
      }

      // Custom validator
      if (rule.custom && typeof rule.custom === 'function') {
        const customError = rule.custom(value);
        if (customError) {
          errors.push(customError);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};

/**
 * Send standardized API response (ALWAYS 200 status)
 * @param {Object} res - Express response object
 * @param {boolean} success - Success status
 * @param {Object} data - Response data (for success) or error info (for failure)
 * @returns {Object} Express response
 */
export const sendResult = (res, success, data = {}) => {
  const response = { success, ...data };
  
  // Always return 200 status
  return res.status(200).json(response);
};

/**
 * Async error handler wrapper
 * Wraps async route handlers to catch errors automatically
 * NOW ALWAYS RETURNS 200 STATUS with error in body
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 * 
 * @example
 * router.get('/api/test', asyncHandler(async (req, res) => {
 *   const data = await someAsyncOperation();
 *   res.json({ success: true, data });
 * }));
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error('Async handler error:', error);
      
      // ALWAYS return 200 status with error in body
      res.status(200).json({
        success: false,
        error: error.message || 'Internal server error',
        errorType: error.name || 'Error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    });
  };
};

/**
 * Create custom validation error
 * @param {string} message - Error message
 * @param {number} status - HTTP status code (default: 400)
 * @returns {Error}
 */
export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

/**
 * Middleware to validate request params/body
 * NOW ALWAYS RETURNS 200 STATUS with validation errors in body
 * @param {Object} rules - Validation rules
 * @param {string} source - Where to get data from ('query', 'body', 'params')
 * @returns {Function} Express middleware
 * 
 * @example
 * router.get('/api/test', 
 *   validateRequest({
 *     url: { required: true, type: 'url' }
 *   }, 'query'),
 *   asyncHandler(async (req, res) => {
 *     // req.query.url is guaranteed to be valid here
 *   })
 * );
 */
export const validateRequest = (rules, source = 'query') => {
  return (req, res, next) => {
    const data = req[source];
    const result = validate.fields(data, rules);

    if (!result.valid) {
      // ALWAYS return 200 status with validation errors in body
      return res.status(200).json({
        success: false,
        error: 'Validation failed',
        errorType: 'ValidationError',
        details: result.errors
      });
    }

    next();
  };
};

/**
 * Parameter normalization utility
 * Provides sensible defaults for common parameters
 * @param {Object} params - Parameters object
 * @param {Object} defaults - Default values
 * @returns {Object} Normalized parameters
 */
export const normalizeParams = (params, defaults = {}) => {
  const normalized = { ...params };
  
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (normalized[key] === undefined || normalized[key] === null || normalized[key] === '') {
      normalized[key] = defaultValue;
    }
  }
  
  return normalized;
};

/**
 * Safe parameter extraction with optional defaults
 * @param {Object} source - Source object (req.query, req.body, etc)
 * @param {string} key - Parameter key
 * @param {any} defaultValue - Default value if not provided
 * @returns {any} Parameter value or default
 */
export const getParam = (source, key, defaultValue = null) => {
  const value = source[key];
  
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  
  return value;
};

export default { validate, asyncHandler, ValidationError, validateRequest, sendResult, normalizeParams, getParam };
