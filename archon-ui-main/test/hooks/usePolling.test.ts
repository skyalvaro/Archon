import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePolling } from '../../src/hooks/usePolling';

describe('usePolling Hook - REAL Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should poll the endpoint at specified intervals', async () => {
    const mockResponse = { data: 'test' };
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
      headers: new Headers({ 'etag': '"v1"' })
    });

    const { result } = renderHook(() => 
      usePolling('/api/test', { interval: 1000 })
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    // Wait for first fetch
    await waitFor(() => {
      expect(result.current.data).toEqual(mockResponse);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Advance timer to trigger second poll
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // Check ETag header was sent on second request
    const secondCall = (global.fetch as any).mock.calls[1];
    expect(secondCall[1].headers['If-None-Match']).toBe('"v1"');
  });

  it('should handle 304 Not Modified responses correctly', async () => {
    const initialData = { value: 'initial' };
    
    // First call returns data
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => initialData,
      headers: new Headers({ 'etag': '"v1"' })
    });

    const { result } = renderHook(() => 
      usePolling('/api/test', { interval: 1000 })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(initialData);
    });

    // Second call returns 304 Not Modified
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 304,
      json: async () => null,
      headers: new Headers({ 'etag': '"v1"' })
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // Data should remain unchanged after 304
    expect(result.current.data).toEqual(initialData);
  });

  it('should pause polling when tab becomes inactive', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' }),
      headers: new Headers()
    });

    renderHook(() => usePolling('/api/test', { interval: 1000 }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Simulate tab becoming hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true
    });
    Object.defineProperty(document, 'hidden', {
      value: true,
      writable: true
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Advance timers - polling should not occur
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Should still be 1 call (no new polls while hidden)
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Simulate tab becoming visible again
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true
    });
    Object.defineProperty(document, 'hidden', {
      value: false,
      writable: true
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Should immediately poll when becoming visible
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle errors and retry with backoff', async () => {
    // First call fails
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => 
      usePolling('/api/test', { interval: 1000 })
    );

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Network error');
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second call succeeds
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: 'recovered' }),
      headers: new Headers()
    });

    // Advance timer for retry
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ data: 'recovered' });
      expect(result.current.error).toBeNull();
    });
  });

  it('should cleanup on unmount', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' }),
      headers: new Headers()
    });

    const { unmount } = renderHook(() => 
      usePolling('/api/test', { interval: 1000 })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    unmount();

    // Advance timers after unmount
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // No additional calls should be made after unmount
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});