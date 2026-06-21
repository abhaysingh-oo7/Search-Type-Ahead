'use strict';

function createCacheDebugRoute(cache) {
  return async (req, res) => {
    const prefix = (req.query.prefix || '').trim().toLowerCase();
    
    // Check if we're using Redis or fallback
    if (cache.isRedisReady) {
      let ttlRemaining = 0;
      try {
        ttlRemaining = await cache.client.ttl(`prefix:${prefix}`);
      } catch (e) {}

      const allStats = await cache.getAllStats();
      
      return res.json({
        prefix: prefix || '(empty)',
        routing: {
          assignedNode: 'redis-primary',
          physicalNodes: ['redis-server'],
          explanation: `Routed centrally to Redis cluster.`,
        },
        cacheStatus: ttlRemaining > 0
          ? {
              hit: true,
              ttlRemaining: `${ttlRemaining}s`,
              cachedAt: new Date().toISOString(),
              resultCount: 'Available in Redis',
            }
          : {
              hit: false,
              reason: 'Not in cache or expired (TTL = 60s)',
            },
        nodeStats: allStats.nodes[0],
      });
    }

    // Fallback path
    const { nodeName, node } = cache.fallbackCluster.getNodeInfo(prefix);
    const inspection = node.inspect(prefix);

    return res.json({
      prefix : prefix || '(empty)',
      routing: {
        assignedNode         : nodeName,
        physicalNodes        : ['node-0', 'node-1', 'node-2'],
        virtualNodesPerNode  : 50,
        totalRingPoints      : 150,
        explanation          : `MD5("${prefix}") maps clockwise to ${nodeName}`,
      },
      cacheStatus: inspection
        ? {
            hit        : true,
            ttlRemaining: `${inspection.ttlRemaining}s`,
            cachedAt   : inspection.cachedAt,
            resultCount: inspection.resultCount,
          }
        : {
            hit   : false,
            reason: 'Not in cache or expired (TTL = 60s)',
          },
      nodeStats: node.getStats(),
    });
  };
}

module.exports = { createCacheDebugRoute };
