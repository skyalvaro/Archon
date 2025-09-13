/**
 * Simple error handler for knowledge base operations
 * Handles API key validation errors from Issue #362
 */

export interface SimpleError extends Error {
  statusCode?: number;
  isAPIKeyError?: boolean;
}

/**
 * Check if error is an API key authentication error
 */
export function isAPIKeyError(error: any): boolean {
  if (!error) return false;
  
  // Check for 401 status code and authentication error type
  if ((error.statusCode === 401 || error.status === 401) && 
      error.message && error.message.toLowerCase().includes('api key')) {
    return true;
  }
  
  return false;
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: any): string {
  if (isAPIKeyError(error)) {
    return "Please verify your API key in Settings before starting a crawl.";
  }
  
  return error instanceof Error ? error.message : "An error occurred.";
}