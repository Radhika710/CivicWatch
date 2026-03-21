/**
 * API utility functions for making requests to the backend
 * All API calls go through the /api proxy configured in vite.config.js
 * In production, uses /prototype03/api base path
 */

// Use Vite's BASE_URL (set in vite.config.js) + api
// BASE_URL will be '/' in dev and '/prototype03/' in production
// This ensures API_BASE is '/api' in dev and '/prototype03/api' in production
const baseUrl = import.meta.env.BASE_URL || '/';
export const API_BASE = `${baseUrl}api`.replace('//', '/');

const requestCache = new Map();
const CACHE_TTL = 60000; // 1 minute TTL
const MAX_CACHE_SIZE = 100;


function getCacheKey(endpoint) {
  return endpoint;
}


function getCachedResponse(key) {
  const cached = requestCache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    requestCache.delete(key);
    return null;
  }
  
  return cached.data;
}


function setCachedResponse(key, data) {
  // Evict oldest entries if cache is full
  if (requestCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = requestCache.keys().next().value;
    requestCache.delete(oldestKey);
  }
  
  requestCache.set(key, {
    data,
    timestamp: Date.now()
  });
}


export function clearCache() {
  requestCache.clear();
}


const pendingRequests = new Map();

/**
 * Build query string from params object
 */
function buildQueryString(params) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, v));
      } else {
        searchParams.append(key, value);
      }
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Fetch with error handling, caching, and request deduplication

 */
async function fetchAPI(endpoint, options = {}) {
  const cacheKey = getCacheKey(endpoint);
  const isGetRequest = !options.method || options.method === 'GET';
  

  if (isGetRequest && !options.skipCache) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }
    

    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey);
    }
  }
  

  const requestPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Cache the response for GET requests
      if (isGetRequest) {
        setCachedResponse(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    } finally {
      // Remove from pending requests
      pendingRequests.delete(cacheKey);
    }
  })();
  
  // Track pending request for deduplication
  if (isGetRequest) {
    pendingRequests.set(cacheKey, requestPromise);
  }
  
  return requestPromise;
}

/**
 * Get all legislators
 */
export async function getLegislators(params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/legislators/${queryString}`);
}

/**
 * Get all states
 */
export async function getStates(params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/states/${queryString}`);
}

/**
 * Get engagement timeline data
 */
export async function getEngagementTimeline(params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/engagement/timeline/${queryString}`);
}

/**
 * Get topics sorted by engagement
 */
export async function getTopicsByEngagement(params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/engagement/topics/${queryString}`);
}

/**
 * Get overview data
 */
export async function getOverviewData(params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/default_overview_data/${queryString}`);
}

/**
 * Get legislator profile
 */
export async function getLegislatorProfile(lid, params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/legislators/${lid}/profile${queryString}`);
}

/**
 * Get topic breakdown
 */
export async function getTopicBreakdown(params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/topics/breakdown/${queryString}`);
}

/**
 * Get all topics
 */
export async function getAllTopics(params = {}) {
  const queryString = buildQueryString(params);
  return fetchAPI(`/topics/${queryString}`);
}


import { useState, useEffect, useRef, useCallback } from 'react';

export function useDebouncedValue(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function useDebouncedCallback(callback, delay = 300) {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);


  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}