"""
Provider-specific error handling adapters for embedding services.

This module provides a unified interface for handling errors from different
LLM providers (OpenAI, Google AI, Anthropic, Ollama, etc.) while maintaining
provider-specific error parsing and sanitization.
"""

import re
from abc import ABC, abstractmethod

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
    def sanitize_error_message(self, message: str) -> str:
        """Sanitize provider-specific sensitive data from error messages."""
        pass


class OpenAIErrorAdapter(ProviderErrorAdapter):
    """Error adapter for OpenAI API errors."""

    def get_provider_name(self) -> str:
        return "openai"

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
            (r'Bearer [a-zA-Z0-9._-]+', 'Bearer [REDACTED_AUTH_TOKEN]'),
        ]

        for pattern, replacement in patterns:
            sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)

        # Check for sensitive words
        sensitive_words = ['internal', 'server', 'token']
        if any(word in sanitized.lower() for word in sensitive_words):
            return "OpenAI API encountered an error. Please verify your API key and quota."

        return sanitized


class GoogleAIErrorAdapter(ProviderErrorAdapter):
    """Error adapter for Google AI API errors."""

    def get_provider_name(self) -> str:
        return "google"

    def sanitize_error_message(self, message: str) -> str:
        """Sanitize Google AI-specific sensitive data."""
        if not isinstance(message, str) or not message.strip():
            return "Google AI API encountered an error. Please verify your API key."

        if len(message) > 2000:
            return "Google AI API encountered an error. Please verify your API key."

        sanitized = message
        
        # Google AI API key format: AIzaSy...
        if 'AIza' in sanitized:
            words = sanitized.split()
            for i, word in enumerate(words):
                if word.startswith('AIza') and len(word) == 39:
                    words[i] = '[REDACTED_KEY]'
            sanitized = ' '.join(words)
        
        return sanitized


class ProviderErrorFactory:
    """Factory for provider-specific error handling."""

    _adapters = {
        "openai": OpenAIErrorAdapter(),
        "google": GoogleAIErrorAdapter(),
    }

    @classmethod
    def get_adapter(cls, provider: str) -> ProviderErrorAdapter:
        """Get error adapter for the specified provider."""
        return cls._adapters.get(provider.lower(), cls._adapters["openai"])

    @classmethod
    def sanitize_provider_error(cls, message: str, provider: str) -> str:
        """Sanitize error message using provider-specific adapter."""
        adapter = cls.get_adapter(provider)
        return adapter.sanitize_error_message(message)

    @classmethod
    def detect_provider_from_error(cls, error_str: str) -> str:
        """Attempt to detect provider from error message content."""
        error_lower = error_str.lower()
        
        if "google" in error_lower or "AIza" in error_str:
            return "google"
        else:
            return "openai"  # Default fallback