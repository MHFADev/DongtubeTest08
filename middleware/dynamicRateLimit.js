import rateLimit from 'express-rate-limit';
import { RateLimitConfig, IpWhitelist } from '../models/index.js';

let rateLimitCache = null;
let rateLimitCacheTime = 0;
const CACHE_DURATION = 30000;

let whitelistCache = null;
let whitelistCacheTime = 0;

const limiterInstances = new Map();

export const loadRateLimitConfigs = async () => {
  const configs = await RateLimitConfig.findAll({
    where: { enabled: true }
  });
  
  const configMap = new Map();
  configs.forEach(config => {
    const key = `${config.targetType}:${config.targetValue}`;
    configMap.set(key, {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs
    });
  });
  
  return configMap;
};

export const loadWhitelist = async () => {
  const whitelist = await IpWhitelist.findAll({
    where: { enabled: true }
  });
  
  const whitelistMap = new Map();
  whitelist.forEach(entry => {
    whitelistMap.set(entry.ipAddress, true);
  });
  
  return whitelistMap;
};

export const checkWhitelist = async (ip) => {
  const now = Date.now();
  if (!whitelistCache || (now - whitelistCacheTime) > CACHE_DURATION) {
    whitelistCache = await loadWhitelist();
    whitelistCacheTime = now;
  }
  
  return whitelistCache.has(ip);
};

const getOrCreateLimiter = (maxRequests, windowMs) => {
  const limiterKey = `${maxRequests}:${windowMs}`;
  
  if (!limiterInstances.has(limiterKey)) {
    const limiter = rateLimit({
      windowMs: windowMs,
      max: maxRequests,
      message: {
        success: false,
        error: `Too many requests. Limit: ${maxRequests} per ${Math.floor(windowMs / 1000)} seconds`,
        retryAfter: Math.ceil(windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    limiterInstances.set(limiterKey, limiter);
  }
  
  return limiterInstances.get(limiterKey);
};

export const createDynamicRateLimiter = () => {
  return async (req, res, next) => {
    try {
      const ip = req.ip || req.connection?.remoteAddress;
      
      const isWhitelisted = await checkWhitelist(ip);
      if (isWhitelisted) {
        return next();
      }

      const now = Date.now();
      if (!rateLimitCache || (now - rateLimitCacheTime) > CACHE_DURATION) {
        rateLimitCache = await loadRateLimitConfigs();
        rateLimitCacheTime = now;
      }

      let maxRequests = 100;
      let windowMs = 3600000;

      if (req.user) {
        const roleKey = `role:${req.user.role}`;
        const userKey = `user:${req.user.id}`;
        
        if (rateLimitCache.has(userKey)) {
          const config = rateLimitCache.get(userKey);
          maxRequests = config.maxRequests;
          windowMs = config.windowMs;
        } else if (rateLimitCache.has(roleKey)) {
          const config = rateLimitCache.get(roleKey);
          maxRequests = config.maxRequests;
          windowMs = config.windowMs;
        }
      }

      const endpointKey = `endpoint:${req.path}`;
      if (rateLimitCache.has(endpointKey)) {
        const config = rateLimitCache.get(endpointKey);
        maxRequests = config.maxRequests;
        windowMs = config.windowMs;
      }

      const limiter = getOrCreateLimiter(maxRequests, windowMs);
      limiter(req, res, next);
    } catch (error) {
      console.error('Rate limit error:', error);
      next();
    }
  };
};

export const refreshRateLimitCache = () => {
  rateLimitCache = null;
  rateLimitCacheTime = 0;
  whitelistCache = null;
  whitelistCacheTime = 0;
  limiterInstances.clear();
  console.log('✓ Rate limit cache refreshed');
};

export default { createDynamicRateLimiter, refreshRateLimitCache, loadRateLimitConfigs };
