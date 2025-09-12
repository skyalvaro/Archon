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
    // Apply enhanced error parsing for OpenAI errors
    const enhancedError = parseKnowledgeBaseError({
      status: error.statusCode || error.status,
      error: error.message || error.detail || error,
      detail: error.detail
    });
    
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
      const timeoutError = parseKnowledgeBaseError(new Error('Request timed out'));
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