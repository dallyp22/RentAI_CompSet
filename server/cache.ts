/**
 * Simple in-memory cache for expensive operations
 */

interface CacheEntry {
  data: any;
  timestamp: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry> = new Map();

  get(key: string, maxAge: number): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const age = Date.now() - entry.timestamp;
    if (age > maxAge) {
      // Expired
      this.cache.delete(key);
      return null;
    }
    
    console.log(`[CACHE] Hit: ${key} (age: ${Math.round(age / 1000)}s)`);
    return entry.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    console.log(`[CACHE] Set: ${key}`);
  }

  delete(key: string): void {
    this.cache.delete(key);
    console.log(`[CACHE] Deleted: ${key}`);
  }

  clear(): void {
    this.cache.clear();
    console.log(`[CACHE] Cleared all entries`);
  }

  size(): number {
    return this.cache.size;
  }
}

export const cache = new SimpleCache();

// Cache durations (in milliseconds)
export const CACHE_DURATIONS = {
  COMPETITOR_PROPERTIES: 60 * 60 * 1000, // 1 hour
  UNIT_DETAILS: 24 * 60 * 60 * 1000, // 24 hours
  PROPERTY_SEARCH: 30 * 60 * 1000, // 30 minutes
};

