"""Unit tests for progress API endpoints with polling support."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, Response
from fastapi.testclient import TestClient

from src.server.api_routes.progress_api import get_progress, list_active_operations, router
from src.server.services.projects.progress_service import ProgressService


@pytest.fixture
def mock_progress_service():
    """Create a mock progress service for testing."""
    service = MagicMock(spec=ProgressService)
    service.active_operations = {}
    return service


@pytest.fixture
def test_client():
    """Create a test client for the progress router."""
    from fastapi import FastAPI
    
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


class TestGetProgress:
    """Tests for the get_progress endpoint."""

    @pytest.mark.asyncio
    async def test_get_progress_success(self, mock_progress_service):
        """Test successful progress retrieval."""
        operation_data = {
            "type": "project_creation",
            "status": "running",
            "percentage": 45,
            "step": "Generating tasks...",
            "start_time": datetime.now(),
            "logs": ["Starting...", "Processing..."],
        }
        
        with patch("src.server.api_routes.progress_api.progress_service", mock_progress_service):
            mock_progress_service.get_operation_status.return_value = operation_data
            
            response = Response()
            result = await get_progress("op-123", response=response, if_none_match=None)
            
            assert result["operation_id"] == "op-123"
            assert result["status"] == "running"
            assert result["percentage"] == 45
            assert result["message"] == "Generating tasks..."
            assert result["error"] is None
            
            # Check headers
            assert "ETag" in response.headers
            assert response.headers["X-Poll-Interval"] == "1000"  # Running = poll every second

    @pytest.mark.asyncio
    async def test_get_progress_not_found(self, mock_progress_service):
        """Test progress retrieval for non-existent operation."""
        with patch("src.server.api_routes.progress_api.progress_service", mock_progress_service):
            mock_progress_service.get_operation_status.return_value = None
            
            response = Response()
            with pytest.raises(HTTPException) as exc_info:
                await get_progress("non-existent", response=response)
            
            assert exc_info.value.status_code == 404
            assert "not found" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_get_progress_with_etag_match(self, mock_progress_service):
        """Test progress retrieval with matching ETag (304 response)."""
        operation_data = {
            "type": "project_creation",
            "status": "running",
            "percentage": 45,
            "step": "Processing...",
        }
        
        with patch("src.server.api_routes.progress_api.progress_service", mock_progress_service):
            mock_progress_service.get_operation_status.return_value = operation_data
            
            # First request to get ETag
            response1 = Response()
            result1 = await get_progress("op-123", response=response1, if_none_match=None)
            etag = response1.headers["ETag"]
            
            # Second request with same data and ETag
            response2 = Response()
            result2 = await get_progress("op-123", response=response2, if_none_match=etag)
            
            assert result2 is None  # No content for 304
            assert response2.status_code == 304  # Not Modified

    @pytest.mark.asyncio
    async def test_get_progress_completed(self, mock_progress_service):
        """Test progress retrieval for completed operation."""
        operation_data = {
            "type": "project_creation",
            "status": "completed",
            "percentage": 100,
            "step": "Finished",
        }
        
        with patch("src.server.api_routes.progress_api.progress_service", mock_progress_service):
            mock_progress_service.get_operation_status.return_value = operation_data
            
            response = Response()
            result = await get_progress("op-123", response=response)
            
            assert result["status"] == "completed"
            assert result["percentage"] == 100
            assert response.headers["X-Poll-Interval"] == "0"  # No polling needed

    @pytest.mark.asyncio
    async def test_get_progress_failed(self, mock_progress_service):
        """Test progress retrieval for failed operation."""
        operation_data = {
            "type": "project_creation",
            "status": "failed",
            "percentage": 30,
            "step": "Error occurred",
            "error": "API rate limit exceeded",
        }
        
        with patch("src.server.api_routes.progress_api.progress_service", mock_progress_service):
            mock_progress_service.get_operation_status.return_value = operation_data
            
            response = Response()
            result = await get_progress("op-123", response=response)
            
            assert result["status"] == "failed"
            assert result["error"] == "API rate limit exceeded"
            assert response.headers["X-Poll-Interval"] == "0"  # No polling needed

    @pytest.mark.asyncio
    async def test_get_progress_etag_changes_with_update(self, mock_progress_service):
        """Test that ETag changes when operation data updates."""
        with patch("src.server.api_routes.progress_api.progress_service", mock_progress_service):
            # Initial state
            mock_progress_service.get_operation_status.return_value = {
                "status": "running",
                "percentage": 30,
                "step": "Step 1",
            }
            
            response1 = Response()
            await get_progress("op-123", response=response1)
            etag1 = response1.headers["ETag"]
            
            # Updated state
            mock_progress_service.get_operation_status.return_value = {
                "status": "running",
                "percentage": 60,
                "step": "Step 2",
            }
            
            response2 = Response()
            await get_progress("op-123", response=response2, if_none_match=etag1)
            etag2 = response2.headers["ETag"]
            
            assert etag1 != etag2
            assert response2.status_code != 304  # Should return new data


class TestListActiveOperations:
    """Tests for the list_active_operations endpoint."""

    @pytest.mark.asyncio
    async def test_list_active_operations_empty(self, mock_progress_service):
        """Test listing when no active operations."""
        with patch("src.server.api_routes.progress_api.progress_service", mock_progress_service):
            mock_progress_service.active_operations = {}
            
            result = await list_active_operations()
            
            assert result["operations"] == []
            assert result["count"] == 0
            assert "timestamp" in result

    @pytest.mark.asyncio
    async def test_list_active_operations_with_running(self, mock_progress_service):
        """Test listing with running operations."""
        with patch("src.server.api_routes.progress_api.progress_service", mock_progress_service):
            mock_progress_service.active_operations = {
                "op-1": {
                    "type": "project_creation",
                    "status": "running",
                    "percentage": 50,
                    "step": "Processing...",
                    "start_time": datetime(2024, 1, 1, 12, 0, 0),
                },
                "op-2": {
                    "type": "crawl",
                    "status": "starting",
                    "percentage": 0,
                    "step": "Initializing...",
                },
                "op-3": {
                    "type": "project_creation",
                    "status": "completed",  # Should not be included
                    "percentage": 100,
                    "step": "Done",
                },
            }
            
            result = await list_active_operations()
            
            assert result["count"] == 2  # Only running and starting
            assert len(result["operations"]) == 2
            
            # Check first operation
            op1 = next((op for op in result["operations"] if op["operation_id"] == "op-1"), None)
            assert op1 is not None
            assert op1["operation_type"] == "project_creation"
            assert op1["status"] == "running"
            assert op1["percentage"] == 50
            assert op1["started_at"] == "2024-01-01T12:00:00"

    @pytest.mark.asyncio
    async def test_list_active_operations_filters_completed(self, mock_progress_service):
        """Test that completed and failed operations are filtered out."""
        with patch("src.server.api_routes.progress_api.progress_service", mock_progress_service):
            mock_progress_service.active_operations = {
                "op-1": {"status": "completed", "type": "test"},
                "op-2": {"status": "failed", "type": "test"},
                "op-3": {"status": "error", "type": "test"},
                "op-4": {"status": "running", "type": "test", "percentage": 50, "step": "Running"},
            }
            
            result = await list_active_operations()
            
            assert result["count"] == 1
            assert result["operations"][0]["operation_id"] == "op-4"


class TestProgressAPIIntegration:
    """Integration tests for progress API with real HTTP client."""

    def test_get_progress_http(self, test_client):
        """Test progress endpoint via HTTP client."""
        with patch("src.server.api_routes.progress_api.progress_service") as mock_service:
            mock_service.get_operation_status.return_value = {
                "status": "running",
                "percentage": 75,
                "step": "Almost done",
            }
            
            response = test_client.get("/api/progress/test-op")
            
            assert response.status_code == 200
            data = response.json()
            assert data["operation_id"] == "test-op"
            assert data["percentage"] == 75
            assert "ETag" in response.headers

    def test_get_progress_http_not_found(self, test_client):
        """Test progress endpoint 404 via HTTP client."""
        with patch("src.server.api_routes.progress_api.progress_service") as mock_service:
            mock_service.get_operation_status.return_value = None
            
            response = test_client.get("/api/progress/non-existent")
            
            assert response.status_code == 404
            assert "not found" in response.json()["detail"]["error"].lower()

    def test_get_progress_http_with_etag(self, test_client):
        """Test progress endpoint with ETag header via HTTP client."""
        with patch("src.server.api_routes.progress_api.progress_service") as mock_service:
            mock_service.get_operation_status.return_value = {
                "status": "running",
                "percentage": 50,
                "step": "Processing",
            }
            
            # First request to get ETag
            response1 = test_client.get("/api/progress/test-op")
            etag = response1.headers["ETag"]
            
            # Second request with If-None-Match
            response2 = test_client.get(
                "/api/progress/test-op",
                headers={"If-None-Match": etag}
            )
            
            assert response2.status_code == 304  # Not Modified
            assert response2.content == b""  # No body

    def test_list_operations_http(self, test_client):
        """Test list operations endpoint via HTTP client."""
        with patch("src.server.api_routes.progress_api.progress_service") as mock_service:
            mock_service.active_operations = {
                "op-1": {
                    "type": "test",
                    "status": "running",
                    "percentage": 25,
                    "step": "Testing",
                }
            }
            
            response = test_client.get("/api/progress/")
            
            assert response.status_code == 200
            data = response.json()
            assert data["count"] == 1
            assert len(data["operations"]) == 1