'use strict';

const { createClient } = require('redis');
const { CacheCluster } = require('./cacheCluster');

const TTL_SECONDS = 60; // 60s TTL
const REDIS_URL = process.env.REDIS_URL || null;

class RedisCacheClient {
  constructor() {
    this.fallbackCluster = new CacheCluster(['node-0', 'node-1', 'node-2']);
    this.isRedisReady = false;
    this.client = null;
    
    // Stats for Redis when active
    this.hits = 0;
    this.misses = 0;
  }

  async connect() {
    if (!REDIS_URL) {
      console.log('[RedisCache] No REDIS_URL provided. Falling back to local CacheCluster.');
      return;
    }

    try {
      this.client = createClient({ url: REDIS_URL });
      
      this.client.on('error', (err) => {
        console.error('[RedisCache] Redis Client Error:', err.message);
        this.isRedisReady = false;
      });

      this.client.on('ready', () => {
        console.log('[RedisCache] Successfully connected to Redis.');
        this.isRedisReady = true;
      });

      await this.client.connect();
    } catch (e) {
      console.error('[RedisCache] Failed to connect to Redis. Falling back to local CacheCluster.', e.message);
      this.isRedisReady = false;
    }
  }

  async get(key) {
    if (!this.isRedisReady) {
      return this.fallbackCluster.get(key);
    }
    
    try {
      const data = await this.client.get(`prefix:${key}`);
      if (data) {
        this.hits++;
        return JSON.parse(data);
      } else {
        this.misses++;
        return null;
      }
    } catch (e) {
      console.error('[RedisCache] GET error', e);
      return null;
    }
  }

  async set(key, results) {
    if (!this.isRedisReady) {
      return this.fallbackCluster.set(key, results);
    }

    try {
      await this.client.setEx(`prefix:${key}`, TTL_SECONDS, JSON.stringify(results));
    } catch (e) {
      console.error('[RedisCache] SET error', e);
    }
  }

  async invalidateForQuery(query) {
    const q = query.toLowerCase();
    
    if (!this.isRedisReady) {
      return this.fallbackCluster.invalidateForQuery(q);
    }

    try {
      // Invalidate all prefixes
      const keysToDelete = [];
      for (let i = 1; i <= q.length; i++) {
        keysToDelete.push(`prefix:${q.slice(0, i)}`);
      }
      
      if (keysToDelete.length > 0) {
        await this.client.del(keysToDelete);
      }
    } catch (e) {
      console.error('[RedisCache] Invalidate error', e);
    }
  }

  getNodeForKey(key) {
    if (!this.isRedisReady) {
      return this.fallbackCluster.getNodeForKey(key);
    }
    return 'redis-primary';
  }

  async getAllStats() {
    if (!this.isRedisReady) {
      return this.fallbackCluster.getAllStats();
    }

    const total = this.hits + this.misses;
    let entries = 0;
    try {
      entries = await this.client.dbSize();
    } catch (e) {}

    return {
      nodes: [{
        name: 'redis-primary',
        entries: entries,
        hits: this.hits,
        misses: this.misses,
        hitRate: total > 0 ? parseFloat((this.hits / total * 100).toFixed(1)) : 0,
        evictions: 0
      }],
      overall: {
        hits: this.hits,
        misses: this.misses,
        hitRate: total > 0 ? parseFloat((this.hits / total * 100).toFixed(1)) : 0,
      }
    };
  }
}

module.exports = { RedisCacheClient };
