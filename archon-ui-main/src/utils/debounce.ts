/**
 * Generic debounce function with TypeScript types
 * Delays the execution of a function until after a delay period
 * has passed without the function being called again
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>) {
    // Clear the previous timeout if it exists
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // Set a new timeout
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Debounce function that returns a promise
 * Useful for async operations that need to be debounced
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let resolvePromise: ((value: ReturnType<T>) => void) | null = null;
  let rejectPromise: ((reason?: any) => void) | null = null;

  return function debounced(...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise((resolve, reject) => {
      // Clear the previous timeout if it exists
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        // Reject the previous promise if it exists
        if (rejectPromise) {
          rejectPromise(new Error('Debounced'));
        }
      }

      resolvePromise = resolve;
      rejectPromise = reject;

      // Set a new timeout
      timeoutId = setTimeout(async () => {
        try {
          const result = await func(...args);
          if (resolvePromise) {
            resolvePromise(result);
          }
        } catch (error) {
          if (rejectPromise) {
            rejectPromise(error);
          }
        } finally {
          timeoutId = null;
          resolvePromise = null;
          rejectPromise = null;
        }
      }, delay);
    });
  };
}