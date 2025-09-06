/**
 * Error handling utilities for knowledge base operations
 * 
 * Provides specialized error handling for OpenAI API errors,
 * rate limiting, and quota exhaustion scenarios.
 * 
 * Related to GitHub issue #362 - improves user experience
 * by displaying clear error messages when OpenAI API fails.
 */

export interface OpenAIErrorDetails {
  error: string;
  message: string;
  error_type: 'authentication_required' | 'authentication_failed' | 'quota_exhausted' | 'rate_limit' | 'api_error';
  tokens_used?: number;
  retry_after?: number;
}

// Valid OpenAI error types
const VALID_ERROR_TYPES = [
  'authentication_required',
  'authentication_failed', 
  'quota_exhausted', 
  'rate_limit', 
  'api_error'
] as const;

/**
 * Validate and normalize error type from API response
 */
function validateErrorType(errorType: any): OpenAIErrorDetails['error_type'] {
  if (typeof errorType === 'string' && VALID_ERROR_TYPES.includes(errorType as any)) {
    return errorType as OpenAIErrorDetails['error_type'];
  }
  return 'api_error'; // Default fallback
}

export interface EnhancedError extends Error {
  statusCode?: number;
  errorDetails?: OpenAIErrorDetails;
  isOpenAIError?: boolean;
}

/**
 * Create a fallback error for cases where input is invalid or unparseable
 */
function createFallbackError(reason: string): EnhancedError {
  return Object.assign(new Error('Unknown error occurred'), {
    errorDetails: {
      error: 'unknown',
      message: sanitizeMessage(`${reason}. Please try again or contact support if the problem persists.`),
      error_type: 'api_error' as const
    }
  }) as EnhancedError;
}

// Constants for validation
const MAX_OBJECT_KEYS = 100;
const MAX_RECURSION_DEPTH = 10;

// Sanitization patterns for frontend error messages
const REDACTION_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9]{10,}\b/g, 'sk-REDACTED'],
  [/\borg-[A-Za-z0-9]{6,}\b/g, 'org-REDACTED'],
  [/\bproj_[A-Za-z0-9]{10,}\b/g, 'proj_REDACTED'],
  [/\bBearer\s+[A-Za-z0-9._-]{10,}\b/gi, 'Bearer REDACTED'],
  [/\bhttps?:\/\/[^\s]{1,200}/gi, '[REDACTED_URL]'],
];

function sanitizeMessage(msg: unknown): string {
  if (typeof msg !== 'string' || msg.length === 0) return 'Unknown error occurred';
  let out = msg.slice(0, 10_000); // cap length
  for (const [re, replacement] of REDACTION_PATTERNS) {
    out = out.replace(re, replacement);
  }
  return out;
}

/**
 * Check if an object can be safely serialized (no circular references)
 */
function isSafeObject(obj: any, visited = new WeakSet(), depth = 0): boolean {
  if (typeof obj !== 'object' || obj === null) return true;
  if (depth > MAX_RECURSION_DEPTH) return false;
  
  // Quick size check to prevent expensive operations on large objects
  if (Object.keys(obj).length > MAX_OBJECT_KEYS) return false;
  
  // Check for circular references
  if (visited.has(obj)) return false;
  visited.add(obj);
  
  // Check each property recursively
  try {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (!isSafeObject(obj[key], visited, depth + 1)) {
          return false;
        }
      }
    }
    return true;
  } catch {
    // Error during traversal indicates unsafe object
    return false;
  }
}

/**
 * Parse and enhance API errors from knowledge base operations
 */
export function parseKnowledgeBaseError(error: any): EnhancedError {
  if (process.env.NODE_ENV !== 'production') {
    const safeMsg = sanitizeMessage((error && (error.message || error?.response?.data?.message)) ?? '');
    console.debug('parseKnowledgeBaseError', { status: error?.status ?? error?.response?.status, message: safeMsg });
  }
  
  // Enhanced input validation
  if (!error) {
    return createFallbackError('No error information provided');
  }
  
  if (typeof error === 'string') {
    return Object.assign(new Error(error), {
      errorDetails: {
        error: 'api_error',
        message: error,
        error_type: 'api_error' as const
      }
    }) as EnhancedError;
  }
  
  if (typeof error !== 'object' || error === null) {
    return createFallbackError('Invalid error format');
  }

  // Check for empty objects or objects with no useful properties
  if (error.constructor === Object && Object.keys(error).length === 0) {
    return createFallbackError('Empty error object received');
  }

  // Check for circular references and object safety
  if (!isSafeObject(error)) {
    return createFallbackError('Error object contains circular references');
  }

  // Handle Error instances that might have been serialized/deserialized
  if (error instanceof Error || (error.name && error.message && error.stack)) {
    // This is likely an Error object, proceed with parsing
  } else if (!error.message && !error.error && !error.detail && !error.status) {
    // Object doesn't have any recognizable error properties
    return createFallbackError('Unrecognized error object structure');
  }
  
  const baseMessage =
    (typeof error?.message === 'string' && error.message) ||
    (typeof error?.response?.data?.message === 'string' && error.response.data.message) ||
    'Unknown error';
  const enhancedError: EnhancedError = new Error(sanitizeMessage(baseMessage));
  
  // Check if this is an HTTP response error with JSON details
  if (error && typeof error === 'object') {
    // Handle fetch Response errors
    if (typeof error.status === 'number') enhancedError.statusCode = error.status;
    if (typeof error.statusCode === 'number') enhancedError.statusCode = error.statusCode;
    if (typeof error.response?.status === 'number') enhancedError.statusCode = error.response.status;
    if (typeof error.response?.statusCode === 'number') enhancedError.statusCode = error.response.statusCode;
    
    // Parse error details from API response
    if (error.error || error.detail || error.response?.data) {
      const errorData = error.error || error.detail || error.response?.data?.error || error.response?.data;
      
      // Check if it's an OpenAI-specific error
      if (typeof errorData === 'object' && errorData.error_type) {
        enhancedError.isOpenAIError = true;
        
        // Validate and normalize the error details
        const validatedErrorType = validateErrorType(errorData.error_type);
        enhancedError.errorDetails = {
          error: errorData.error || 'unknown',
          message: errorData.message || 'Unknown error occurred',
          error_type: validatedErrorType,
          tokens_used: typeof errorData.tokens_used === 'number' ? errorData.tokens_used : undefined,
          retry_after: typeof errorData.retry_after === 'number' ? errorData.retry_after : undefined
        };
        
        // Set a more descriptive message based on error type
        switch (validatedErrorType) {
          case 'authentication_required':
          case 'authentication_failed':
            enhancedError.message = '401 Unauthorized - Invalid OpenAI API key. Please verify your OpenAI API key in Settings before starting a crawl.';
            break;
          case 'quota_exhausted':
            enhancedError.message = 'OpenAI API quota exhausted. Please add credits to your OpenAI account or check your billing settings.';
            break;
          case 'rate_limit':
            enhancedError.message = 'OpenAI API rate limit exceeded. Please wait a moment and try again.';
            break;
          case 'api_error':
            enhancedError.message = sanitizeMessage(
              `OpenAI API error: ${typeof errorData.message === 'string' ? errorData.message : 'Unknown error'}. Please check your API key configuration.`
            );
            break;
          default:
            enhancedError.message = sanitizeMessage(
              (typeof errorData.message === 'string' && errorData.message) ||
                (typeof errorData.error === 'string' && errorData.error) ||
                enhancedError.message
            );
        }
      }
    }
  }
  
  return enhancedError;
}

/**
 * Get user-friendly error message for display in UI
 */
export function getDisplayErrorMessage(error: EnhancedError): string {
  if (error.isOpenAIError && error.errorDetails) {
    switch (error.errorDetails.error_type) {
      case 'authentication_required':
      case 'authentication_failed':
        return `401 Unauthorized - Invalid OpenAI API key. Please verify your OpenAI API key in Settings before starting a crawl.`;
      
      case 'quota_exhausted':
        return `OpenAI API quota exhausted. Please add credits to your OpenAI account or check your billing settings.`;
      
      case 'rate_limit':
        return `OpenAI API rate limit exceeded. Please wait a moment and try again.`;
      
      case 'api_error':
        return sanitizeMessage(`OpenAI API error: ${error.errorDetails.message}. Please check your API key configuration.`);
      
      default:
        return sanitizeMessage(error.errorDetails.message || error.message);
    }
  }
  
  // Handle HTTP status codes
  if (error.statusCode) {
    switch (error.statusCode) {
      case 401:
        return '401 Unauthorized - Invalid or missing OpenAI credentials. Verify your API key in Settings.';
      case 403:
        return '403 Forbidden - Your OpenAI key/org/project lacks access to this operation.';
      case 429:
        return 'API rate limit exceeded. Please wait a moment and try again.';
      case 502:
        return 'API service unavailable. Please try again in a few minutes.';
      case 503:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return sanitizeMessage(error.message);
    }
  }
  
  return sanitizeMessage(error.message || 'An unexpected error occurred.');
}

/**
 * Get error severity level for UI styling
 */
export function getErrorSeverity(error: EnhancedError): 'error' | 'warning' | 'info' {
  if (error.isOpenAIError && error.errorDetails) {
    switch (error.errorDetails.error_type) {
      case 'quota_exhausted':
        return 'error'; // Critical - user action required
      case 'rate_limit':
        return 'warning'; // Temporary - retry may work
      case 'api_error':
        return 'error'; // Likely configuration issue
      default:
        return 'error';
    }
  }
  
  if (error.statusCode && error.statusCode >= 500) {
    return 'error'; // Server errors
  }
  if (error.statusCode === 401 || error.statusCode === 403) return 'error';
  if (error.statusCode === 429) return 'warning';
  return 'warning'; // Default for other 4xx/unknown
}

/**
 * Get suggested action for the user based on error type
 */
export function getErrorAction(error: EnhancedError): string | null {
  if (error.isOpenAIError && error.errorDetails) {
    switch (error.errorDetails.error_type) {
      case 'authentication_required':
      case 'authentication_failed':
        return 'Go to Settings and verify your OpenAI API key';
      case 'quota_exhausted':
        return 'Check your OpenAI billing dashboard and add credits';
      case 'rate_limit': {
        const retryAfter = error.errorDetails.retry_after ?? 30;
        return `Wait ${retryAfter} seconds and try again`;
      }
      case 'api_error':
        return 'Verify your OpenAI API key in Settings';
      default:
        return null;
    }
  }
  
  // HTTP fallback when no OpenAI-specific details are present
  if (error.statusCode) {
    switch (error.statusCode) {
      case 401:
        return 'Go to Settings and verify your OpenAI API key';
      case 403:
        return 'Check your OpenAI org/project permissions';
      case 429: {
        const retryAfter = error.errorDetails?.retry_after ?? 30;
        return `Wait ${retryAfter} seconds and try again`;
      }
      default:
        return null;
    }
  }
  return null;
}