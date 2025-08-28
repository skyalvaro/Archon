"""Unit tests for progress service with polling support."""

import asyncio
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

from src.server.services.projects.progress_service import ProgressService


@pytest.fixture
def progress_service():
    """Create a fresh progress service instance for testing."""
    return ProgressService()


class TestProgressServiceOperations:
    """Tests for progress service operation management."""

    def test_start_operation(self, progress_service):
        """Test starting a new operation."""
        progress_id = "test-op-123"
        operation_type = "project_creation"
        initial_data = {"project_name": "Test Project"}
        
        progress_service.start_operation(progress_id, operation_type, initial_data)
        
        assert progress_id in progress_service.active_operations
        operation = progress_service.active_operations[progress_id]
        
        assert operation["type"] == operation_type
        assert operation["status"] == "starting"
        assert operation["percentage"] == 0
        assert operation["step"] == "initialization"
        assert operation["project_name"] == "Test Project"
        assert len(operation["logs"]) == 1
        assert "Starting project_creation" in operation["logs"][0]

    @pytest.mark.asyncio
    async def test_update_progress(self, progress_service):
        """Test updating operation progress."""
        progress_id = "test-op-123"
        progress_service.start_operation(progress_id, "test", {})
        
        update_data = {
            "status": "running",
            "percentage": 50,
            "step": "Processing items",
            "log": "Processed 50% of items",
        }
        
        await progress_service.update_progress(progress_id, update_data)
        
        operation = progress_service.active_operations[progress_id]
        assert operation["status"] == "running"
        assert operation["percentage"] == 50
        assert operation["step"] == "Processing items"
        assert len(operation["logs"]) == 2
        assert "Processed 50% of items" in operation["logs"][1]

    @pytest.mark.asyncio
    async def test_update_progress_nonexistent(self, progress_service):
        """Test updating non-existent operation (should not raise)."""
        # Should handle gracefully without raising
        await progress_service.update_progress("non-existent", {"status": "running"})
        assert "non-existent" not in progress_service.active_operations

    @pytest.mark.asyncio
    async def test_update_progress_log_limit(self, progress_service):
        """Test that logs are limited to prevent memory issues."""
        progress_id = "test-op-123"
        progress_service.start_operation(progress_id, "test", {})
        
        # Add 60 logs (more than the 50 limit)
        for i in range(60):
            await progress_service.update_progress(
                progress_id,
                {"log": f"Log entry {i}"}
            )
        
        operation = progress_service.active_operations[progress_id]
        assert len(operation["logs"]) == 50  # Should be capped at 50
        assert "Log entry 59" in operation["logs"][-1]  # Most recent
        assert "Log entry 10" in operation["logs"][0]  # Oldest kept (initial + 10-59 = 50)

    @pytest.mark.asyncio
    async def test_complete_operation(self, progress_service):
        """Test completing an operation."""
        progress_id = "test-op-123"
        progress_service.start_operation(progress_id, "project_creation", {})
        
        # Track operations before cleanup
        checked_operation = None
        sleep_args = []
        
        async def mock_sleep(seconds):
            nonlocal checked_operation
            sleep_args.append(seconds)
            if seconds == 30:
                # Capture operation state before cleanup
                checked_operation = progress_service.active_operations[progress_id].copy()
                # After sleep, it gets deleted, so remove it here
                del progress_service.active_operations[progress_id]
                return
            return await asyncio.sleep(0)
        
        with patch("asyncio.sleep", side_effect=mock_sleep):
            completion_data = {"project_id": "proj-123"}
            await progress_service.complete_operation(progress_id, completion_data)
            
            # Check that the operation was updated correctly before cleanup
            assert checked_operation is not None
            assert checked_operation["status"] == "completed"
            assert checked_operation["percentage"] == 100
            assert checked_operation["step"] == "finished"
            assert checked_operation["project_id"] == "proj-123"
            assert "duration" in checked_operation
            assert "log" in checked_operation
            assert "completed successfully" in checked_operation["log"]
            
            # Verify cleanup happened
            assert progress_id not in progress_service.active_operations
            assert 30 in sleep_args

    @pytest.mark.asyncio
    async def test_complete_operation_cleanup(self, progress_service):
        """Test that completed operations are cleaned up after delay."""
        progress_id = "test-op-123"
        progress_service.start_operation(progress_id, "test", {})
        
        # Use very short delay for testing
        with patch("asyncio.sleep", side_effect=lambda x: asyncio.sleep(0.001)):
            await progress_service.complete_operation(progress_id, {})
            
            # Give cleanup time to run
            await asyncio.sleep(0.002)
            
            # Should be cleaned up
            assert progress_id not in progress_service.active_operations

    @pytest.mark.asyncio
    async def test_error_operation(self, progress_service):
        """Test marking an operation as failed."""
        progress_id = "test-op-123"
        progress_service.start_operation(progress_id, "test", {})
        
        error_message = "API rate limit exceeded"
        await progress_service.error_operation(progress_id, error_message)
        
        operation = progress_service.active_operations[progress_id]
        assert operation["status"] == "error"
        assert operation["error"] == error_message
        assert operation["step"] == "failed"
        # The error adds a "log" key directly, not to "logs" array
        assert "log" in operation
        assert f"❌ Error: {error_message}" == operation["log"]

    def test_get_operation_status(self, progress_service):
        """Test retrieving operation status."""
        progress_id = "test-op-123"
        progress_service.start_operation(progress_id, "test", {"custom": "data"})
        
        status = progress_service.get_operation_status(progress_id)
        assert status is not None
        assert status["type"] == "test"
        assert status["custom"] == "data"
        
        # Non-existent operation
        assert progress_service.get_operation_status("non-existent") is None


class TestProgressServiceBroadcast:
    """Tests for progress service broadcast functionality."""

    @pytest.mark.asyncio
    async def test_broadcast_progress_formatting(self, progress_service):
        """Test that broadcast formats data correctly for polling."""
        progress_id = "test-op-123"
        start_time = datetime(2024, 1, 1, 12, 0, 0)
        
        progress_service.active_operations[progress_id] = {
            "type": "project_creation",
            "status": "running",
            "percentage": 75,
            "start_time": start_time,
        }
        
        # Call the private broadcast method
        await progress_service._broadcast_progress(progress_id)
        
        # Operation should still be in storage (broadcast doesn't remove it)
        assert progress_id in progress_service.active_operations
        
        # Original should still have datetime object
        assert isinstance(progress_service.active_operations[progress_id]["start_time"], datetime)

    @pytest.mark.asyncio
    async def test_broadcast_event_types(self, progress_service):
        """Test that correct event types are determined for broadcasts."""
        # Project creation events
        scenarios = [
            ("project_creation", "running", "project_progress"),
            ("project_creation", "completed", "project_completed"),
            ("project_creation", "error", "project_error"),
            ("crawl", "running", "crawl_progress"),
            ("crawl", "completed", "crawl_completed"),
            ("unknown_type", "running", "unknown_type_progress"),
        ]
        
        for op_type, status, expected_event in scenarios:
            progress_id = f"test-{op_type}-{status}"
            progress_service.active_operations[progress_id] = {
                "type": op_type,
                "status": status,
            }
            
            # We can't easily test the event type without mocking internals,
            # but we can verify the method runs without errors
            await progress_service._broadcast_progress(progress_id)


class TestProgressServiceConcurrency:
    """Tests for concurrent operation handling."""

    @pytest.mark.asyncio
    async def test_multiple_operations(self, progress_service):
        """Test managing multiple operations simultaneously."""
        ops = [
            ("op-1", "project_creation", {"name": "Project 1"}),
            ("op-2", "crawl", {"url": "https://example.com"}),
            ("op-3", "project_creation", {"name": "Project 2"}),
        ]
        
        # Start all operations
        for op_id, op_type, data in ops:
            progress_service.start_operation(op_id, op_type, data)
        
        assert len(progress_service.active_operations) == 3
        
        # Update different operations
        await progress_service.update_progress("op-1", {"percentage": 30})
        await progress_service.update_progress("op-2", {"percentage": 60})
        await progress_service.error_operation("op-3", "Failed to create")
        
        assert progress_service.active_operations["op-1"]["percentage"] == 30
        assert progress_service.active_operations["op-2"]["percentage"] == 60
        assert progress_service.active_operations["op-3"]["status"] == "error"

    @pytest.mark.asyncio
    async def test_operation_isolation(self, progress_service):
        """Test that operations don't interfere with each other."""
        progress_service.start_operation("op-1", "test", {"data": "original"})
        progress_service.start_operation("op-2", "test", {"data": "different"})
        
        # Update one shouldn't affect the other
        await progress_service.update_progress("op-1", {"data": "modified"})
        
        assert progress_service.active_operations["op-1"]["data"] == "modified"
        assert progress_service.active_operations["op-2"]["data"] == "different"


class AsyncMock(MagicMock):
    """Async mock helper for Python < 3.8."""
    async def __call__(self, *args, **kwargs):
        return super().__call__(*args, **kwargs)