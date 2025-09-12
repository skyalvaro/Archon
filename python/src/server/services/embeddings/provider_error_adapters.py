"""
Provider-specific error handling adapters for embedding services.

This module provides a unified interface for handling errors from different
LLM providers (OpenAI, Google AI, Anthropic, Ollama, etc.) while maintaining
provider-specific error parsing and sanitization.
"""

import re
from abc import ABC, abstractmethod
from typing import Any

from .embedding_exceptions import (
    EmbeddingAPIError,
    EmbeddingAuthenticationError,
    EmbeddingQuotaExhaustedError,
    EmbeddingRateLimitError,
)


class ProviderErrorAdapter(ABC):
    """Abstract base class for provider-specific error handling."""

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the provider name for this adapter."""
        pass

    @abstractmethod
    def parse_error(self, error: Exception) -> Exception:
        """Parse provider-specific error into standard embedding exception."""
        pass

    @abstractmethod
    def sanitize_error_message(self, message: str) -> str:
        """Sanitize provider-specific sensitive data from error messages."""
        pass

    @abstractmethod
    def get_api_key_formats(self) -> list[str]:
        """Return regex patterns for detecting this provider's API keys."""
        pass


class OpenAIErrorAdapter(ProviderErrorAdapter):
    """Error adapter for OpenAI API errors."""

    def get_provider_name(self) -> str:
        return "openai"

    def parse_error(self, error: Exception) -> Exception:
        """Parse OpenAI-specific errors into standard embedding exceptions."""
        error_str = str(error)
        
        # Handle OpenAI authentication errors
        if ("401" in error_str and ("invalid" in error_str.lower() or "incorrect" in error_str.lower())):
            # Extract API key prefix if available
            api_key_prefix = None
            if "sk-" in error_str:
                import re
                key_match = re.search(r'sk-([a-zA-Z0-9]{3})', error_str)
                if key_match:
                    api_key_prefix = f"sk-{key_match.group(1)}…"
            
            return EmbeddingAuthenticationError(
                "Invalid OpenAI API key", 
                api_key_prefix=api_key_prefix
            )
        
        # Handle quota exhaustion
        elif ("quota" in error_str.lower() or "billing" in error_str.lower() or "credits" in error_str.lower()):
            # Try to extract token usage if available
            tokens_used = None
            token_match = re.search(r'(\d+)\s*tokens?', error_str, re.IGNORECASE)
            if token_match:
                tokens_used = int(token_match.group(1))
            
            return EmbeddingQuotaExhaustedError(
                "OpenAI quota exhausted", 
                tokens_used=tokens_used
            )
        
        # Handle rate limiting
        elif ("rate" in error_str.lower() and "limit" in error_str.lower()):
            return EmbeddingRateLimitError("OpenAI rate limit exceeded")
        
        # Generic API error
        else:
            return EmbeddingAPIError(f"OpenAI API error: {error_str}", original_error=error)

    def sanitize_error_message(self, message: str) -> str:
        """Sanitize OpenAI-specific sensitive data."""
        if not isinstance(message, str) or not message.strip():
            return "OpenAI API encountered an error. Please verify your API key and quota."

        if len(message) > 2000:
            return "OpenAI API encountered an error. Please verify your API key and quota."

        sanitized = message
        
        # Use string operations for API key detection (OpenAI format: sk-...)
        if 'sk-' in sanitized:
            words = sanitized.split()
            for i, word in enumerate(words):
                if word.startswith('sk-') and len(word) == 51:
                    words[i] = '[REDACTED_KEY]'
            sanitized = ' '.join(words)
        
        # OpenAI-specific patterns
        patterns = [
            (r'https?://[a-zA-Z0-9.-]+/[^\s]*', '[REDACTED_URL]'),
            (r'org-[a-zA-Z0-9]{24}', '[REDACTED_ORG]'),
            (r'proj_[a-zA-Z0-9]{10,15}', '[REDACTED_PROJ]'),
            (r'req_[a-zA-Z0-9]{6,15}', '[REDACTED_REQ]'),
            (r'Bearer [a-zA-Z0-9._-]+', 'Bearer [REDACTED_AUTH_TOKEN]'),
        ]

        for pattern, replacement in patterns:
            sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)

        # Check for sensitive words
        sensitive_words = ['internal', 'server', 'token']
        if 'endpoint' in sanitized.lower() and '[REDACTED_URL]' not in sanitized:
            sensitive_words.append('endpoint')

        if any(word in sanitized.lower() for word in sensitive_words):
            return "OpenAI API encountered an error. Please verify your API key and quota."

        return sanitized

    def get_api_key_formats(self) -> list[str]:
        return [r'sk-[a-zA-Z0-9]{48}']


class GoogleAIErrorAdapter(ProviderErrorAdapter):
    """Error adapter for Google AI API errors."""

    def get_provider_name(self) -> str:
        return "google"

    def parse_error(self, error: Exception) -> Exception:
        """Parse Google AI-specific errors into standard embedding exceptions."""
        error_str = str(error)
        
        # Handle Google AI authentication errors
        if ("403" in error_str or "401" in error_str) and ("api" in error_str.lower() and "key" in error_str.lower()):
            # Extract API key prefix if available
            api_key_prefix = None
            if "AIza" in error_str:
                key_match = re.search(r'AIza([a-zA-Z0-9]{4})', error_str)
                if key_match:
                    api_key_prefix = f"AIza{key_match.group(1)}…"
            
            return EmbeddingAuthenticationError(
                "Invalid Google AI API key", 
                api_key_prefix=api_key_prefix
            )
        
        # Handle quota/billing issues
        elif ("quota" in error_str.lower() or "exceeded" in error_str.lower() or "billing" in error_str.lower()):
            return EmbeddingQuotaExhaustedError("Google AI quota exceeded")
        
        # Handle rate limiting
        elif ("rate" in error_str.lower() and "limit" in error_str.lower()):
            return EmbeddingRateLimitError("Google AI rate limit exceeded")
        
        # Generic API error
        else:
            return EmbeddingAPIError(f"Google AI API error: {error_str}", original_error=error)

    def sanitize_error_message(self, message: str) -> str:
        """Sanitize Google AI-specific sensitive data."""
        if not isinstance(message, str) or not message.strip():
            return "Google AI API encountered an error. Please verify your API key and quota."

        if len(message) > 2000:
            return "Google AI API encountered an error. Please verify your API key and quota."

        sanitized = message
        
        # Google AI API key format: AIzaSy...
        if 'AIza' in sanitized:
            words = sanitized.split()
            for i, word in enumerate(words):
                if word.startswith('AIza') and len(word) == 39:  # Google AI key format
                    words[i] = '[REDACTED_KEY]'
            sanitized = ' '.join(words)
        
        # Google AI-specific patterns
        patterns = [
            (r'https?://[a-zA-Z0-9.-]*googleapis\.com[^\s]*', '[REDACTED_URL]'),
            (r'projects/[a-zA-Z0-9_-]+', 'projects/[REDACTED_PROJECT]'),
            (r'Bearer [a-zA-Z0-9._-]+', 'Bearer [REDACTED_AUTH_TOKEN]'),
        ]

        for pattern, replacement in patterns:
            sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)

        # Check for Google AI sensitive words
        sensitive_words = ['internal', 'server', 'token', 'project']
        if any(word in sanitized.lower() for word in sensitive_words):
            return "Google AI API encountered an error. Please verify your API key and quota."

        return sanitized

    def get_api_key_formats(self) -> list[str]:
        return [r'AIza[a-zA-Z0-9]{35}']


class AnthropicErrorAdapter(ProviderErrorAdapter):
    """Error adapter for Anthropic API errors."""

    def get_provider_name(self) -> str:
        return "anthropic"

    def parse_error(self, error: Exception) -> Exception:
        """Parse Anthropic-specific errors into standard embedding exceptions."""
        error_str = str(error)
        
        # Handle Anthropic authentication errors
        if ("401" in error_str or "403" in error_str) and ("api" in error_str.lower() and "key" in error_str.lower()):
            api_key_prefix = None
            if "sk-ant" in error_str:
                key_match = re.search(r'sk-ant-([a-zA-Z0-9]{6})', error_str)
                if key_match:
                    api_key_prefix = f"sk-ant-{key_match.group(1)}…"
            
            return EmbeddingAuthenticationError(
                "Invalid Anthropic API key", 
                api_key_prefix=api_key_prefix
            )
        
        # Handle quota/billing issues
        elif ("quota" in error_str.lower() or "billing" in error_str.lower() or "usage" in error_str.lower()):
            return EmbeddingQuotaExhaustedError("Anthropic quota exceeded")
        
        # Handle rate limiting
        elif ("rate" in error_str.lower() and "limit" in error_str.lower()):
            return EmbeddingRateLimitError("Anthropic rate limit exceeded")
        
        # Generic API error
        else:
            return EmbeddingAPIError(f"Anthropic API error: {error_str}", original_error=error)

    def sanitize_error_message(self, message: str) -> str:
        """Sanitize Anthropic-specific sensitive data."""
        if not isinstance(message, str) or not message.strip():
            return "Anthropic API encountered an error. Please verify your API key."

        if len(message) > 2000:
            return "Anthropic API encountered an error. Please verify your API key."

        sanitized = message
        
        # Anthropic API key format: sk-ant-...
        if 'sk-ant-' in sanitized:
            words = sanitized.split()
            for i, word in enumerate(words):
                if word.startswith('sk-ant-') and len(word) > 20:
                    words[i] = '[REDACTED_KEY]'
            sanitized = ' '.join(words)
        
        # Anthropic-specific patterns
        patterns = [
            (r'https?://[a-zA-Z0-9.-]*anthropic\.com[^\s]*', '[REDACTED_URL]'),
            (r'Bearer [a-zA-Z0-9._-]+', 'Bearer [REDACTED_AUTH_TOKEN]'),
        ]

        for pattern, replacement in patterns:
            sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)

        # Check for sensitive words
        sensitive_words = ['internal', 'server', 'token']
        if any(word in sanitized.lower() for word in sensitive_words):
            return "Anthropic API encountered an error. Please verify your API key."

        return sanitized

    def get_api_key_formats(self) -> list[str]:
        return [r'sk-ant-[a-zA-Z0-9_-]+']


class OllamaErrorAdapter(ProviderErrorAdapter):
    """Error adapter for Ollama (local) errors."""

    def get_provider_name(self) -> str:
        return "ollama"

    def parse_error(self, error: Exception) -> Exception:
        """Parse Ollama-specific errors into standard embedding exceptions."""
        error_str = str(error)
        
        # Ollama is typically local, so auth errors are usually connection issues
        if ("connection" in error_str.lower() or "refused" in error_str.lower()):
            return EmbeddingAuthenticationError("Cannot connect to Ollama server")
        
        # Ollama doesn't have quotas, but may have model issues
        elif ("model" in error_str.lower() and ("not found" in error_str.lower() or "not available" in error_str.lower())):
            return EmbeddingAPIError(f"Ollama model error: {error_str}", original_error=error)
        
        # Generic error
        else:
            return EmbeddingAPIError(f"Ollama error: {error_str}", original_error=error)

    def sanitize_error_message(self, message: str) -> str:
        """Sanitize Ollama-specific sensitive data."""
        if not isinstance(message, str) or not message.strip():
            return "Ollama service encountered an error. Please check your Ollama configuration."

        # Ollama doesn't use API keys, but may expose local paths or URLs
        sanitized = message
        
        patterns = [
            (r'http://localhost:\d+', '[REDACTED_LOCAL_URL]'),
            (r'/[a-zA-Z0-9/_.-]+', '[REDACTED_PATH]'),  # Local file paths
        ]

        for pattern, replacement in patterns:
            sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)

        return sanitized

    def get_api_key_formats(self) -> list[str]:
        return []  # Ollama doesn't use API keys


class ProviderErrorFactory:
    """Factory for provider-specific error handling."""

    _adapters = {
        "openai": OpenAIErrorAdapter(),
        "google": GoogleAIErrorAdapter(),
        "anthropic": AnthropicErrorAdapter(), 
        "ollama": OllamaErrorAdapter(),
    }

    @classmethod
    def get_adapter(cls, provider: str) -> ProviderErrorAdapter:
        """Get error adapter for the specified provider."""
        return cls._adapters.get(provider.lower(), cls._adapters["openai"])

    @classmethod
    def parse_provider_error(cls, error: Exception, provider: str) -> Exception:
        """Parse provider-specific error using appropriate adapter."""
        adapter = cls.get_adapter(provider)
        return adapter.parse_error(error)

    @classmethod
    def sanitize_provider_error(cls, message: str, provider: str) -> str:
        """Sanitize error message using provider-specific adapter."""
        adapter = cls.get_adapter(provider)
        return adapter.sanitize_error_message(message)

    @classmethod
    def get_supported_providers(cls) -> list[str]:
        """Get list of supported providers."""
        return list(cls._adapters.keys())

    @classmethod
    def detect_provider_from_error(cls, error_str: str) -> str:
        """Attempt to detect provider from error message content."""
        error_lower = error_str.lower()
        
        # Check for provider-specific patterns in order of specificity
        if "anthropic" in error_lower or "sk-ant-" in error_str:
            return "anthropic"
        elif "google" in error_lower or "googleapis" in error_lower or "AIza" in error_str:
            return "google"
        elif "ollama" in error_lower or "localhost" in error_lower:
            return "ollama"
        elif "openai" in error_lower or "sk-" in error_str:
            return "openai"
        else:
            return "openai"  # Default fallback