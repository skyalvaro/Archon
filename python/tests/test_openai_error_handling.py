"""
Comprehensive test suite for OpenAI error handling enhancements.

Tests the complete error flow from embedding service through RAG service 
to API endpoints, ensuring proper error propagation and message sanitization.

Related to GitHub Issue #362.
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from fastapi import HTTPException

from src.server.services.embeddings.embedding_exceptions import (
    EmbeddingAuthenticationError,
    EmbeddingQuotaExhaustedError,
    EmbeddingRateLimitError,
    EmbeddingAPIError,
)
from src.server.services.search.rag_service import RAGService
from src.server.api_routes.knowledge_api import perform_rag_query, RagQueryRequest, _sanitize_provider_error, _validate_provider_api_key


class TestOpenAIErrorHandling:
    """Test suite for OpenAI error handling in RAG queries."""

    @pytest.mark.asyncio
    async def test_quota_exhausted_error_propagation(self):
        """Test that quota exhausted errors propagate correctly through service layer."""
        
        # Mock the create_embedding function to raise quota exhausted error
        with patch("src.server.services.search.rag_service.create_embedding") as mock_create_embedding:
            mock_create_embedding.side_effect = EmbeddingQuotaExhaustedError(
                "OpenAI quota exhausted", tokens_used=1000
            )
            
            # Create RAG service and test search_documents method
            with patch("src.server.services.search.rag_service.get_supabase_client"):
                rag_service = RAGService()
                
                # Should propagate the quota error, not return empty list
                with pytest.raises(EmbeddingQuotaExhaustedError) as exc_info:
                    await rag_service.search_documents("test query")
                
                assert "quota exhausted" in str(exc_info.value).lower()
                assert exc_info.value.tokens_used == 1000

    @pytest.mark.asyncio
    async def test_authentication_error_propagation(self):
        """Test that authentication errors propagate correctly through service layer."""
        
        # Mock the create_embedding function to raise authentication error
        with patch("src.server.services.search.rag_service.create_embedding") as mock_create_embedding:
            mock_create_embedding.side_effect = EmbeddingAuthenticationError(
                "Invalid API key", api_key_prefix="sk-1234"
            )
            
            # Create RAG service and test search_documents method
            with patch("src.server.services.search.rag_service.get_supabase_client"):
                rag_service = RAGService()
                
                # Should propagate the authentication error
                with pytest.raises(EmbeddingAuthenticationError) as exc_info:
                    await rag_service.search_documents("test query")
                
                assert "invalid api key" in str(exc_info.value).lower()
                assert exc_info.value.api_key_prefix == "sk-1…"

    @pytest.mark.asyncio
    async def test_rate_limit_error_propagation(self):
        """Test that rate limit errors propagate correctly through service layer."""
        
        # Mock the create_embedding function to raise rate limit error
        with patch("src.server.services.search.rag_service.create_embedding") as mock_create_embedding:
            mock_create_embedding.side_effect = EmbeddingRateLimitError(
                "Rate limit exceeded"
            )
            
            # Create RAG service and test search_documents method
            with patch("src.server.services.search.rag_service.get_supabase_client"):
                rag_service = RAGService()
                
                # Should propagate the rate limit error
                with pytest.raises(EmbeddingRateLimitError) as exc_info:
                    await rag_service.search_documents("test query")
                
                assert "rate limit" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_api_quota_error_in_rag_endpoint(self):
        """Test that quota errors are properly handled in RAG API endpoint."""
        
        request = RagQueryRequest(query="test query", match_count=5)
        
        # Mock RAGService to raise quota exhausted error
        with patch("src.server.api_routes.knowledge_api.RAGService") as mock_rag_service_class, \
             patch("src.server.api_routes.knowledge_api.get_supabase_client"):
            
            mock_service = Mock()
            mock_service.perform_rag_query = AsyncMock(
                side_effect=EmbeddingQuotaExhaustedError(
                    "OpenAI quota exhausted", tokens_used=500
                )
            )
            mock_rag_service_class.return_value = mock_service
            
            # Should raise HTTPException with status 429 and detailed error info
            with pytest.raises(HTTPException) as exc_info:
                await perform_rag_query(request)
            
            # Verify error details
            assert exc_info.value.status_code == 429
            assert "quota exhausted" in exc_info.value.detail["error"].lower()
            assert "add credits" in exc_info.value.detail["message"].lower()
            assert exc_info.value.detail["error_type"] == "quota_exhausted"
            assert exc_info.value.detail["error_code"] == "OPENAI_QUOTA_EXHAUSTED"
            assert exc_info.value.detail["tokens_used"] == 500

    @pytest.mark.asyncio
    async def test_api_authentication_error_in_rag_endpoint(self):
        """Test that authentication errors are properly handled in RAG API endpoint."""
        
        request = RagQueryRequest(query="test query", match_count=5)
        
        # Mock RAGService to raise authentication error
        with patch("src.server.api_routes.knowledge_api.RAGService") as mock_rag_service_class, \
             patch("src.server.api_routes.knowledge_api.get_supabase_client"):
            
            mock_service = Mock()
            mock_service.perform_rag_query = AsyncMock(
                side_effect=EmbeddingAuthenticationError(
                    "Invalid API key", api_key_prefix="sk-1234"
                )
            )
            mock_rag_service_class.return_value = mock_service
            
            # Should raise HTTPException with status 401 and detailed error info
            with pytest.raises(HTTPException) as exc_info:
                await perform_rag_query(request)
            
            # Verify error details
            assert exc_info.value.status_code == 401
            assert "authentication failed" in exc_info.value.detail["error"].lower()
            assert "invalid or expired" in exc_info.value.detail["message"].lower()
            assert exc_info.value.detail["error_type"] == "authentication_failed"
            assert exc_info.value.detail["error_code"] == "OPENAI_AUTH_FAILED"
            assert exc_info.value.detail["api_key_prefix"] == "sk-1…"

    @pytest.mark.asyncio
    async def test_api_rate_limit_error_in_rag_endpoint(self):
        """Test that rate limit errors are properly handled in RAG API endpoint."""
        
        request = RagQueryRequest(query="test query", match_count=5)
        
        # Mock RAGService to raise rate limit error
        with patch("src.server.api_routes.knowledge_api.RAGService") as mock_rag_service_class, \
             patch("src.server.api_routes.knowledge_api.get_supabase_client"):
            
            mock_service = Mock()
            mock_service.perform_rag_query = AsyncMock(
                side_effect=EmbeddingRateLimitError("Rate limit exceeded")
            )
            mock_rag_service_class.return_value = mock_service
            
            # Should raise HTTPException with status 429 and detailed error info
            with pytest.raises(HTTPException) as exc_info:
                await perform_rag_query(request)
            
            # Verify error details
            assert exc_info.value.status_code == 429
            assert "rate limit" in exc_info.value.detail["error"].lower()
            assert "too many requests" in exc_info.value.detail["message"].lower()
            assert exc_info.value.detail["error_type"] == "rate_limit"
            assert exc_info.value.detail["retry_after"] == 30

    @pytest.mark.asyncio
    async def test_api_generic_error_in_rag_endpoint(self):
        """Test that generic API errors are properly handled in RAG API endpoint."""
        
        request = RagQueryRequest(query="test query", match_count=5)
        
        # Mock RAGService to raise generic API error
        with patch("src.server.api_routes.knowledge_api.RAGService") as mock_rag_service_class, \
             patch("src.server.api_routes.knowledge_api.get_supabase_client"):
            
            mock_service = Mock()
            mock_service.perform_rag_query = AsyncMock(
                side_effect=EmbeddingAPIError("Invalid model specified")
            )
            mock_rag_service_class.return_value = mock_service
            
            # Should raise HTTPException with status 502 and detailed error info
            with pytest.raises(HTTPException) as exc_info:
                await perform_rag_query(request)
            
            # Verify error details
            assert exc_info.value.status_code == 502
            assert "openai api error" in exc_info.value.detail["error"].lower()
            assert exc_info.value.detail["error_type"] == "api_error"

    @pytest.mark.asyncio
    async def test_api_key_validation_success(self):
        """Test that API key validation passes with valid key."""
        
        # Mock create_embedding to succeed
        with patch("src.server.api_routes.knowledge_api.create_embedding") as mock_create_embedding:
            mock_create_embedding.return_value = [0.1] * 1536  # Mock successful embedding
            
            # Should not raise any exception
            await _validate_provider_api_key()

    @pytest.mark.asyncio
    async def test_api_key_validation_auth_failure(self):
        """Test that API key validation raises 401 for authentication failures."""
        
        # Mock create_embedding to raise authentication error
        with patch("src.server.api_routes.knowledge_api.create_embedding") as mock_create_embedding:
            mock_create_embedding.side_effect = EmbeddingAuthenticationError(
                "Invalid API key", api_key_prefix="sk-1234"
            )
            
            # Should raise HTTPException with status 401
            with pytest.raises(HTTPException) as exc_info:
                await _validate_provider_api_key()
            
            assert exc_info.value.status_code == 401
            assert exc_info.value.detail["error_type"] == "authentication_failed"

    @pytest.mark.asyncio
    async def test_api_key_validation_quota_failure(self):
        """Test that API key validation raises 429 for quota exhaustion."""
        
        # Mock create_embedding to raise quota exhausted error
        with patch("src.server.api_routes.knowledge_api.create_embedding") as mock_create_embedding:
            mock_create_embedding.side_effect = EmbeddingQuotaExhaustedError(
                "Quota exhausted", tokens_used=1000
            )
            
            # Should raise HTTPException with status 429
            with pytest.raises(HTTPException) as exc_info:
                await _validate_provider_api_key()
            
            assert exc_info.value.status_code == 429
            assert exc_info.value.detail["error_type"] == "quota_exhausted"

    def test_sanitize_openai_error_removes_urls(self):
        """Test that sanitization function removes URLs from error messages."""
        error_message = "Connection failed to https://api.openai.com/v1/embeddings with status 400"
        sanitized = _sanitize_provider_error(error_message, "openai")
        
        assert "https://api.openai.com" not in sanitized
        assert "[REDACTED_URL]" in sanitized
        assert "Connection failed" in sanitized

    def test_sanitize_openai_error_removes_api_keys(self):
        """Test that sanitization function removes API keys from error messages."""
        error_message = "Authentication failed with key sk-1234567890abcdef1234567890abcdef1234567890abcdef"
        sanitized = _sanitize_provider_error(error_message, "openai")
        
        assert "sk-1234567890abcdef1234567890abcdef1234567890abcdef" not in sanitized
        assert "[REDACTED_KEY]" in sanitized
        assert "Authentication failed" in sanitized

    def test_sanitize_openai_error_removes_auth_info(self):
        """Test that sanitization function removes auth details from error messages."""
        error_message = 'Failed to authenticate: "auth_bearer_xyz123"'
        sanitized = _sanitize_provider_error(error_message, "openai")
        
        assert "auth_bearer_xyz123" not in sanitized
        assert "[REDACTED_AUTH]" in sanitized

    def test_sanitize_openai_error_returns_generic_for_sensitive_words(self):
        """Test that sanitization returns generic message for sensitive internal details."""
        error_message = "Internal server error on endpoint /v1/embeddings"
        sanitized = _sanitize_provider_error(error_message, "openai")
        
        # Should return generic message due to 'internal' and 'endpoint' keywords
        assert sanitized == "OpenAI API encountered an error. Please verify your API key and quota."

    def test_sanitize_openai_error_preserves_safe_messages(self):
        """Test that sanitization preserves safe error messages."""
        error_message = "Model not found: text-embedding-ada-002"
        sanitized = _sanitize_provider_error(error_message, "openai")
        
        # Should preserve the message since it contains no sensitive info
        assert sanitized == error_message

    def test_sanitize_openai_error_removes_organization_ids(self):
        """Test that sanitization function removes OpenAI organization IDs."""
        error_message = "Permission denied for org-1234567890abcdef12345678 with model access"
        sanitized = _sanitize_provider_error(error_message, "openai")
        
        assert "org-1234567890abcdef12345678" not in sanitized
        assert "[REDACTED_ORG]" in sanitized
        assert "Permission denied" in sanitized

    def test_sanitize_openai_error_removes_project_ids(self):
        """Test that sanitization function removes OpenAI project IDs."""
        error_message = "Project proj_abcdef1234567890xyz not found"
        sanitized = _sanitize_provider_error(error_message, "openai")
        
        assert "proj_abcdef1234567890xyz" not in sanitized
        assert "[REDACTED_PROJ]" in sanitized
        assert "Project" in sanitized and "not found" in sanitized

    def test_sanitize_openai_error_removes_request_ids(self):
        """Test that sanitization function removes OpenAI request IDs."""
        error_message = "Request req_1234567890abcdefghij failed with timeout"
        sanitized = _sanitize_provider_error(error_message, "openai")
        
        assert "req_1234567890abcdefghij" not in sanitized
        assert "[REDACTED_REQ]" in sanitized
        assert "Request" in sanitized and "failed with timeout" in sanitized

    def test_sanitize_openai_error_handles_multiple_patterns(self):
        """Test that sanitization handles multiple sensitive patterns in one message."""
        error_message = "Request req_abc123 to https://api.openai.com failed for org-1234567890abcdef12345678 with key sk-1234567890abcdef1234567890abcdef1234567890abcdef"
        sanitized = _sanitize_provider_error(error_message, "openai")
        
        # Verify all patterns are redacted
        assert "req_abc123" not in sanitized
        assert "https://api.openai.com" not in sanitized
        assert "org-1234567890abcdef12345678" not in sanitized
        assert "sk-1234567890abcdef1234567890abcdef1234567890abcdef" not in sanitized
        
        # Verify redacted placeholders are present
        assert "[REDACTED_REQ]" in sanitized
        assert "[REDACTED_URL]" in sanitized
        assert "[REDACTED_ORG]" in sanitized
        assert "[REDACTED_KEY]" in sanitized

    def test_sanitize_openai_error_input_validation(self):
        """Test that sanitization function handles invalid input gracefully."""
        # Test None input
        result = _sanitize_provider_error(None, "openai")
        assert result == "OpenAI API encountered an error. Please verify your API key and quota."
        
        # Test non-string input
        result = _sanitize_provider_error(123, "openai")
        assert result == "OpenAI API encountered an error. Please verify your API key and quota."
        
        # Test empty string
        result = _sanitize_provider_error("", "openai")
        assert result == "OpenAI API encountered an error. Please verify your API key and quota."
        
        # Test whitespace-only string
        result = _sanitize_provider_error("   ", "openai")
        assert result == "OpenAI API encountered an error. Please verify your API key and quota."

    @pytest.mark.asyncio
    async def test_fail_fast_pattern_embedding_failure(self):
        """Test that embedding failures now fail fast instead of returning empty results."""
        
        # Mock the create_embedding function to return None (failure)
        with patch("src.server.services.search.rag_service.create_embedding") as mock_create_embedding:
            mock_create_embedding.return_value = None
            
            # Create RAG service and test search_documents method
            with patch("src.server.services.search.rag_service.get_supabase_client"):
                rag_service = RAGService()
                
                # Should raise RuntimeError instead of returning empty list
                with pytest.raises(RuntimeError) as exc_info:
                    await rag_service.search_documents("test query")
                
                assert "Failed to create embedding" in str(exc_info.value)
                assert "configuration or API issue" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_fail_fast_pattern_search_failure(self):
        """Test that search failures now fail fast instead of returning empty results."""
        
        # Mock the create_embedding to succeed but vector search to fail
        with patch("src.server.services.search.rag_service.create_embedding") as mock_create_embedding:
            mock_create_embedding.return_value = [0.1] * 1536  # Mock embedding vector
            
            with patch("src.server.services.search.rag_service.get_supabase_client"):
                rag_service = RAGService()
                
                # Mock the base strategy to raise an exception
                with patch.object(rag_service.base_strategy, 'vector_search', side_effect=Exception("Database connection failed")):
                    
                    # Should raise RuntimeError instead of returning empty list
                    with pytest.raises(RuntimeError) as exc_info:
                        await rag_service.search_documents("test query")
                    
                    assert "Document search failed" in str(exc_info.value)
                    assert "Database connection failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_integration_error_flow_rag_to_api(self):
        """Test complete error flow from RAG service through API endpoint."""
        
        request = RagQueryRequest(query="test query", match_count=5)
        
        # Mock both RAGService and get_supabase_client to avoid real connections
        with patch("src.server.api_routes.knowledge_api.RAGService") as mock_rag_service_class, \
             patch("src.server.api_routes.knowledge_api.get_supabase_client"):
            
            mock_service = Mock()
            mock_service.perform_rag_query = AsyncMock(
                side_effect=RuntimeError("Document search failed: Database connection failed")
            )
            mock_rag_service_class.return_value = mock_service
            
            # Should raise HTTPException with generic error (not OpenAI specific)
            with pytest.raises(HTTPException) as exc_info:
                await perform_rag_query(request)
            
            # Verify error details
            assert exc_info.value.status_code == 500
            assert "RAG query failed" in exc_info.value.detail["error"]
            assert "Database connection failed" in exc_info.value.detail["error"]

    @pytest.mark.asyncio
    async def test_api_error_sanitization_in_endpoint(self):
        """Test that API errors are sanitized in the RAG endpoint response."""
        
        request = RagQueryRequest(query="test query", match_count=5)
        
        # Mock RAGService to raise API error with sensitive information
        with patch("src.server.api_routes.knowledge_api.RAGService") as mock_rag_service_class, \
             patch("src.server.api_routes.knowledge_api.get_supabase_client"):
            
            mock_service = Mock()
            mock_service.perform_rag_query = AsyncMock(
                side_effect=EmbeddingAPIError("Request failed to https://api.openai.com/v1/embeddings with key sk-1234567890abcdef1234567890abcdef1234567890abcdef")
            )
            mock_rag_service_class.return_value = mock_service
            
            # Should raise HTTPException with sanitized error message
            with pytest.raises(HTTPException) as exc_info:
                await perform_rag_query(request)
            
            # Verify error is sanitized
            error_message = exc_info.value.detail["message"]
            assert "sk-1234567890abcdef1234567890abcdef1234567890abcdef" not in error_message
            assert "https://api.openai.com" not in error_message
            assert "[REDACTED_KEY]" in error_message
            assert "[REDACTED_URL]" in error_message

    @pytest.mark.asyncio
    async def test_successful_rag_query_flow(self):
        """Test that successful RAG queries work correctly."""
        
        request = RagQueryRequest(query="test query", match_count=5)
        
        # Mock RAGService to return successful result
        mock_result = {
            "results": [{"content": "test result"}],
            "query": "test query",
            "total_found": 1,
        }
        
        with patch("src.server.api_routes.knowledge_api.RAGService") as mock_rag_service_class, \
             patch("src.server.api_routes.knowledge_api.get_supabase_client"):
            
            mock_service = Mock()
            mock_service.perform_rag_query = AsyncMock(return_value=(True, mock_result))
            mock_rag_service_class.return_value = mock_service
            
            # Should return successful result
            result = await perform_rag_query(request)
            
            # Verify successful response
            assert result["success"] is True
            assert result["results"] == [{"content": "test result"}]
            assert result["total_found"] == 1