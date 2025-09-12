/**
 * Enhanced API client for knowledge base operations with OpenAI error handling
 * Built on top of the ETag-aware API client with additional error parsing
 */

import { callAPIWithETag } from "../../projects/shared/apiWithEtag";
import { parseKnowledgeBaseError, type EnhancedError } from "../utils/errorHandler";

/**
 * API call wrapper with enhanced OpenAI error handling
 * Uses ETag caching for efficiency while adding specialized error parsing
 */
export async function callKnowledgeAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    // Use the ETag-aware API client for caching benefits
    return await callAPIWithETag<T>(endpoint, options);
  } catch (error: any) {
    // Handle ProjectServiceError specifically (comes from callAPIWithETag)
    let errorData;
    if (error.constructor?.name === 'ProjectServiceError') {
      // The ETag client extracts the error message but loses the structured details
      // We need to reconstruct the structured error based on the status code and message
      
      // Detect provider from error message and use appropriate error structure
      let provider = "LLM";
      if (error.message.includes("OpenAI")) provider = "OpenAI";
      else if (error.message.includes("Google")) provider = "Google";
      else if (error.message.includes("Anthropic")) provider = "Anthropic";
      else if (error.message.includes("Ollama")) provider = "Ollama";
      
      if (error.statusCode === 401 && error.message.toLowerCase().includes("api key")) {
        // Generic authentication error
        errorData = {
          status: 401,
          error: error.message,
          detail: {
            error: `Invalid ${provider} API key`,
            message: `Please verify your ${provider} API key in Settings before starting a crawl.`,
            error_type: "authentication_failed",
            error_code: `${provider.toUpperCase()}_AUTH_FAILED`,
            provider: provider.toLowerCase()
          }
        };
      } else if (error.statusCode === 429 && error.message.toLowerCase().includes("quota")) {
        // Generic quota error
        errorData = {
          status: 429,
          error: error.message,
          detail: {
            error: `${provider} quota exhausted`,
            message: `Your ${provider} API quota has been exceeded. Please check your billing settings.`,
            error_type: "quota_exhausted",
            error_code: `${provider.toUpperCase()}_QUOTA_EXHAUSTED`,
            provider: provider.toLowerCase()
          }
        };
      } else if (error.statusCode === 429 && error.message.toLowerCase().includes("rate limit")) {
        // Generic rate limit error
        errorData = {
          status: 429,
          error: error.message,
          detail: {
            error: `${provider} API rate limit exceeded`,
            message: `Too many requests to ${provider} API. Please wait a moment and try again.`,
            error_type: "rate_limit",
            error_code: `${provider.toUpperCase()}_RATE_LIMIT`,
            provider: provider.toLowerCase()
          }
        };
      } else if (error.statusCode === 502 && (error.message.toLowerCase().includes("api") || error.message.includes(provider))) {
        // Generic API error
        errorData = {
          status: 502,
          error: error.message,
          detail: {
            error: `${provider} API error`,
            message: `${provider} API error. Please check your API key configuration.`,
            error_type: "api_error",
            error_code: `${provider.toUpperCase()}_API_ERROR`,
            provider: provider.toLowerCase()
          }
        };
      } else {
        // For other ProjectServiceErrors, use the message as-is
        errorData = {
          status: error.statusCode,
          error: error.message,
          detail: null
        };
      }
    } else {
      // Handle other error types
      errorData = {
        status: error.statusCode || error.status,
        error: error.message || error.detail || error,
        detail: error.detail
      };
    }
    
    // Apply enhanced error parsing for OpenAI errors
    const enhancedError = parseKnowledgeBaseError(errorData);
    
    // Preserve the original error structure but enhance with our parsing
    const finalError = error as EnhancedError;
    finalError.isOpenAIError = enhancedError.isOpenAIError;
    finalError.errorDetails = enhancedError.errorDetails;
    finalError.message = enhancedError.message;
    
    throw finalError;
  }
}

/**
 * Enhanced upload wrapper that handles FormData and file uploads with better error handling
 */
export async function uploadWithEnhancedErrors(
  endpoint: string,
  formData: FormData,
  timeoutMs: number = 30000
): Promise<any> {
  const API_BASE_URL = "/api"; // Use same base as other services
  
  let fullUrl = `${API_BASE_URL}${endpoint}`;
  
  // Handle test environment URLs
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
    const testHost = process.env?.VITE_HOST || "localhost";
    const testPort = process.env?.ARCHON_SERVER_PORT || "8181";
    fullUrl = `http://${testHost}:${testPort}${fullUrl}`;
  }
  
  try {
    const response = await fetch(fullUrl, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        const text = await response.text();
        errorData = { status: response.status, error: text };
      }
      
      // Apply enhanced error parsing
      const enhancedError = parseKnowledgeBaseError({
        status: response.status,
        error: errorData.detail || errorData.error || errorData,
        detail: errorData.detail
      });
      
      throw enhancedError;
    }

    return response.json();
  } catch (error: any) {
    // Check if it's a timeout error
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = parseKnowledgeBaseError({
        status: 408,
        error: 'Request timed out',
        detail: {
          error: 'Request timeout',
          message: 'The request took too long to complete. Please try again or check your network connection.',
          error_type: 'timeout_error',
          error_code: 'REQUEST_TIMEOUT'
        }
      });
      throw timeoutError;
    }
    
    // If it's already an enhanced error, re-throw it
    if (error && typeof error === 'object' && 'isOpenAIError' in error) {
      throw error;
    }
    
    // Parse other errors through the error handler for consistency
    throw parseKnowledgeBaseError(error);
  }
}