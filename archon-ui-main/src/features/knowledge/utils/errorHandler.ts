/**
 * Error handling utilities for knowledge base operations
 * 
 * Provides specialized error handling for OpenAI API errors,
 * rate limiting, and quota exhaustion scenarios.
 * 
 * Related to GitHub issue #362 - improves user experience
 * by displaying clear error messages when OpenAI API fails.
 */

export interface ProviderErrorDetails {
  error: string;
  message: string;
  error_type: 'quota_exhausted' | 'rate_limit' | 'api_error' | 'authentication_failed' | 'timeout_error' | 'configuration_error';
  error_code?: string; // Structured error code for reliable detection
  provider?: string; // LLM provider (openai, google, anthropic, ollama)
  tokens_used?: number;
  retry_after?: number;
  api_key_prefix?: string;
}

export interface EnhancedError extends Error {
  statusCode?: number;
  errorDetails?: ProviderErrorDetails;
  isProviderError?: boolean; // Renamed from isOpenAIError for genericity
}

/**
 * Create a fallback error for cases where input is invalid or unparseable
 */
function createFallbackError(reason: string): EnhancedError {
  return Object.assign(new Error('Unknown error occurred'), {
    errorDetails: {
      error: 'unknown',
      message: `${reason}. Please try again or contact support if the problem persists.`,
      error_type: 'api_error' as const
    }
  }) as EnhancedError;
}

/**
 * Check if an object can be safely serialized (no circular references)
 */
function isSafeObject(obj: any): boolean {
  try {
    JSON.stringify(obj);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse and enhance API errors from knowledge base operations
 */
export function parseKnowledgeBaseError(error: any): EnhancedError {
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
  
  const enhancedError: EnhancedError = new Error(error.message || 'Unknown error');
  
  // Check if this is an HTTP response error with JSON details
  if (error && typeof error === 'object') {
    // Handle fetch Response errors
    if (error.status || error.statusCode) {
      enhancedError.statusCode = error.status || error.statusCode;
    }
    
    // Parse error details from API response
    if (error.detail || error.error) {
      // Prioritize error.detail (where we put structured OpenAI error data)
      const errorData = error.detail || error.error;
      
      // Check if it's a provider-specific error
      if (typeof errorData === 'object' && errorData?.error_type) {
        enhancedError.isProviderError = true;
        enhancedError.errorDetails = errorData as ProviderErrorDetails;
        
        // Override the message with the detailed error message
        enhancedError.message = errorData.message || errorData.error || enhancedError.message;
      }
    }
  }
  
  return enhancedError;
}

/**
 * Get user-friendly error message for display in UI
 */
export function getDisplayErrorMessage(error: EnhancedError): string {
  if (error.isProviderError && error.errorDetails) {
    const provider = error.errorDetails.provider ? error.errorDetails.provider.charAt(0).toUpperCase() + error.errorDetails.provider.slice(1) : 'LLM';
    switch (error.errorDetails.error_type) {
      case 'quota_exhausted':
        return `${provider} API quota exhausted. Please add credits to your ${provider} account or check your billing settings.`;
      
      case 'rate_limit':
        return `${provider} API rate limit exceeded. Please wait a moment and try again.`;
      
      case 'authentication_failed':
        return `Invalid or expired ${provider} API key. Please check your API key in settings.`;
      
      case 'api_error':
        return `${provider} API error: ${error.errorDetails.message}. Please check your API key configuration.`;
      
      case 'timeout_error':
        return `Request timed out. Please try again or check your network connection.`;
      
      case 'configuration_error':
        return `${provider} API configuration error. Please check your API key settings.`;
      
      default:
        return error.errorDetails.message || error.message;
    }
  }
  
  // Handle HTTP status codes
  if (error.statusCode) {
    switch (error.statusCode) {
      case 401:
        return 'Authentication failed. Please check your API key.';
      case 429:
        return 'API rate limit exceeded. Please wait a moment and try again.';
      case 502:
        return 'API service unavailable. Please try again in a few minutes.';
      case 503:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return error.message;
    }
  }
  
  return error.message || 'An unexpected error occurred.';
}

/**
 * Get error severity level for UI styling
 */
export function getErrorSeverity(error: EnhancedError): 'error' | 'warning' | 'info' {
  if (error.isProviderError && error.errorDetails) {
    switch (error.errorDetails.error_type) {
      case 'quota_exhausted':
        return 'error'; // Critical - user action required
      case 'authentication_failed':
        return 'error'; // Critical - configuration issue
      case 'rate_limit':
        return 'warning'; // Temporary - retry may work
      case 'api_error':
        return 'error'; // Likely configuration issue
      case 'timeout_error':
        return 'warning'; // Temporary - retry may work
      case 'configuration_error':
        return 'error'; // Configuration issue
      default:
        return 'error';
    }
  }
  
  if (error.statusCode && error.statusCode >= 500) {
    return 'error'; // Server errors
  }
  
  return 'warning'; // Default to warning for other errors
}

/**
 * Get suggested action for the user based on error type
 */
export function getErrorAction(error: EnhancedError): string | null {
  if (error.isProviderError && error.errorDetails) {
    const provider = error.errorDetails.provider ? error.errorDetails.provider.charAt(0).toUpperCase() + error.errorDetails.provider.slice(1) : 'LLM';
    switch (error.errorDetails.error_type) {
      case 'quota_exhausted':
        return `Check your ${provider} billing dashboard and add credits`;
      case 'authentication_failed':
        return `Verify your ${provider} API key in Settings`;
      case 'rate_limit':
        const retryAfter = error.errorDetails.retry_after;
        if (retryAfter && retryAfter > 0) {
          return `Wait ${retryAfter} seconds and try again`;
        } else {
          return 'Wait a moment and try again';
        }
      case 'api_error':
        return `Verify your ${provider} API key in Settings`;
      case 'timeout_error':
        return 'Check your network connection and try again';
      case 'configuration_error':
        return `Check your ${provider} API key in Settings`;
      default:
        return null;
    }
  }
  
  return null;
}