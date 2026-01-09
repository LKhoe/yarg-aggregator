// Browser-compatible utilities for cache reader
export const path = {
  join: (...segments: string[]): string => {
    return segments.join('/').replace(/\/+/g, '/');
  }
};

export const fs = {
  existsSync: (path: string): boolean => {
    // In browser, we can't check file existence
    // This should be handled at the call site
    return false;
  },
  statSync: (path: string): any => {
    // In browser, we can't get file stats
    // This should be handled at the call site
    throw new Error('fs.statSync is not available in browser');
  },
  readFileSync: (path: string): Buffer => {
    // In browser, we can't read files directly
    // This should be handled at the call site
    throw new Error('fs.readFileSync is not available in browser');
  }
};
