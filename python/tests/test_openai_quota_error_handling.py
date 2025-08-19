"""
Test OpenAI quota error handling in RAG queries.

This test verifies that when OpenAI API quota is exhausted,
the error is properly propagated through the service layer
and returned to API clients with detailed error information.

Related to GitHub issue #362.
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi import HTTPException

from src.server.services.embeddings.embedding_exceptions import (
    EmbeddingQuotaExhaustedError,
    EmbeddingRateLimitError,
    EmbeddingAPIError,
)
from src.server.services.search.rag_service import RAGService
from src.server.api_routes.knowledge_api import perform_rag_query, RagQueryRequest


class TestOpenAIQuotaErrorHandling:
    """Test suite for OpenAI quota error handling in RAG queries."""

    @pytest.mark.asyncio
    async def test_quota_exhausted_error_propagation(self):
        """Test that quota exhausted errors propagate correctly through service layer."""
        
        # Mock the create_embedding function to raise quota error
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
                
                # Should propagate the rate limit error, not return empty list
                with pytest.raises(EmbeddingRateLimitError) as exc_info:
                    await rag_service.search_documents("test query")
                
                assert "rate limit" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_api_quota_error_in_rag_endpoint(self):
        """Test that quota errors are properly handled in RAG API endpoint."""
        
        request = RagQueryRequest(query="test query", match_count=5)
        
        # Mock RAGService to raise quota exhausted error
        with patch("src.server.api_routes.knowledge_api.RAGService") as mock_rag_service_class:
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
            assert "no remaining credits" in exc_info.value.detail["message"].lower()
            assert exc_info.value.detail["error_type"] == "quota_exhausted"
            assert exc_info.value.detail["tokens_used"] == 500

    @pytest.mark.asyncio
    async def test_api_rate_limit_error_in_rag_endpoint(self):
        """Test that rate limit errors are properly handled in RAG API endpoint."""
        
        request = RagQueryRequest(query="test query", match_count=5)
        
        # Mock RAGService to raise rate limit error
        with patch("src.server.api_routes.knowledge_api.RAGService") as mock_rag_service_class:
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

    @pytest.mark.asyncio
    async def test_api_generic_error_in_rag_endpoint(self):
        """Test that generic API errors are properly handled in RAG API endpoint."""
        
        request = RagQueryRequest(query="test query", match_count=5)
        
        # Mock RAGService to raise generic API error
        with patch("src.server.api_routes.knowledge_api.RAGService") as mock_rag_service_class:
            mock_service = Mock()
            mock_service.perform_rag_query = AsyncMock(
                side_effect=EmbeddingAPIError("Invalid API key")
            )
            mock_rag_service_class.return_value = mock_service
            
            # Should raise HTTPException with status 502 and detailed error info
            with pytest.raises(HTTPException) as exc_info:
                await perform_rag_query(request)
            
            # Verify error details
            assert exc_info.value.status_code == 502
            assert "api error" in exc_info.value.detail["error"].lower()
            assert "invalid api key" in exc_info.value.detail["message"].lower()
            assert exc_info.value.detail["error_type"] == "api_error"

    @pytest.mark.asyncio
    async def test_successful_rag_query_still_works(self):
        """Test that successful RAG queries still work after error handling changes."""
        
        request = RagQueryRequest(query="test query", match_count=5)
        
        # Mock RAGService to return successful result
        mock_result = {
            "results": [{"content": "test result"}],
            "query": "test query",
            "total_found": 1,
        }
        
        with patch("src.server.api_routes.knowledge_api.RAGService") as mock_rag_service_class:
            mock_service = Mock()
            mock_service.perform_rag_query = AsyncMock(return_value=(True, mock_result))
            mock_rag_service_class.return_value = mock_service
            
            # Should return successful result
            result = await perform_rag_query(request)
            
            # Verify successful response
            assert result["success"] is True
            assert result["results"] == [{"content": "test result"}]
            assert result["total_found"] == 1