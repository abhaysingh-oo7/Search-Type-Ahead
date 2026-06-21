'use strict';

// Autocomplete Backend API
// Integrates all services and initializes Express.
// Seeds the database and constructs the Trie structure in-memory on start.

const express = require('express');
const cors    = require('cors');

const store                 = require('./db/database');
const { Trie }              = require('./trie');
const { RedisCacheClient }  = require('./cache/redisCache');
const { BatchWriter }       = require('./batchWriter');
const { TrendingService }   = require('./trending');

const { createSuggestRoute }    = require('./routes/suggest');
const { createSearchRoute }     = require('./routes/search');
const { createCacheDebugRoute } = require('./routes/cacheDebug');
const { createTrendingRoute }   = require('./routes/trendingRoute');
const { createStatsRoute }      = require('./routes/stats');

const PORT = process.env.PORT || 3001;

// Sliding window tracker for endpoint metrics
class LatencyTracker {
  constructor(maxSamples = 1000) {
    this.latencies  = [];
    this.maxSamples = maxSamples;
    this.dbReads    = 0;
  }

  recordLatency(ms) {
    this.latencies.push(ms);
    if (this.latencies.length > this.maxSamples) this.latencies.shift();
  }

  getPercentile(p) {
    if (!this.latencies.length) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const idx    = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
    return sorted[idx];
  }

  getAverage() {
    if (!this.latencies.length) return 0;
    return Math.round(this.latencies.reduce((s, v) => s + v, 0) / this.latencies.length);
  }
}

// Server initialization
async function main() {
  console.log('\n🚀  Initializing QuickSearch API...\n');

  // 1. Auto-seed if DataStore is empty
  if (store.countAll() === 0) {
    console.log('📦  DataStore is empty. Starting dataset seed...');
    const { seedDatabase } = require('../scripts/seed');
    seedDatabase(store);
    console.log('✅  Seeding complete.\n');
  } else {
    console.log(`📊  Found ${store.countAll().toLocaleString()} queries in DataStore.\n`);
  }

  // 2. Build Trie
  console.log('🌳  Building Trie index...');
  const trie      = new Trie();
  const buildStart = Date.now();

  for (const row of store.getAllRows()) {
    const score = row.trendingScore > 0 ? row.trendingScore : row.count;
    trie.insert(row.query, score, row.count);
  }

  console.log(
    `✅  Trie built: ${store.countAll().toLocaleString()} queries in ` +
    `${Date.now() - buildStart}ms\n`
  );

  const cache       = new RedisCacheClient();
  await cache.connect();
  const trending    = new TrendingService(store);
  const stats       = new LatencyTracker();
  const batchWriter = new BatchWriter(store, trie, cache, trending);

  batchWriter.start();

  // refresh trending scores every 5 minutes
  setInterval(() => trending.recomputeAll(), 5 * 60 * 1000);

  // Express setup
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use((req, _res, next) => {
    if (!req.path.startsWith('/suggest')) {
      console.log(`[${new Date().toTimeString().slice(0, 8)}] ${req.method} ${req.path}`);
    }
    next();
  });

  app.get('/suggest',     createSuggestRoute(trie, cache, stats));
  app.post('/search',     createSearchRoute(batchWriter));
  app.get('/cache/debug', createCacheDebugRoute(cache));
  app.get('/trending',    createTrendingRoute(trending));
  app.get('/stats',       createStatsRoute(stats, cache, batchWriter, trie));

  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) + 's' })
  );

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err, _req, res, _next) => {
    console.error('[Error]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(PORT, () => {
    console.log(`\n✅  Server listening on http://localhost:${PORT}`);
    console.log('   GET  /suggest?q=<prefix>');
    console.log('   POST /search');
    console.log('   GET  /cache/debug?prefix=<prefix>');
    console.log('   GET  /trending');
    console.log('   GET  /stats\n');
  });

  const shutdown = () => {
    console.log('\n[Server] Shutting down...');
    batchWriter.stop();
    store.save();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT',  shutdown);
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
