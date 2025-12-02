import { readdirSync } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { ApiEndpoint } from '../models/index.js';
import { Op } from 'sequelize';

class RouteMetadataReader {
  constructor(routesPath) {
    this.routesPath = routesPath;
    this.cache = new Map();
    this.cacheTimestamp = 0;
    this.CACHE_DURATION = 5000;
  }

  async getEndpointsFromRoutes(includeInactive = false) {
    const currentTime = Date.now();
    const cacheKey = `endpoints_${includeInactive}`;
    
    if (this.cache.has(cacheKey) && (currentTime - this.cacheTimestamp) < this.CACHE_DURATION) {
      console.log(chalk.cyan('📦 Using cached route metadata'));
      return this.cache.get(cacheKey);
    }

    console.log(chalk.cyan('🔍 Reading endpoint metadata from route files...'));
    
    const routeFiles = readdirSync(this.routesPath).filter(file => file.endsWith('.js'));
    const allEndpoints = [];
    const processedFiles = [];

    for (const file of routeFiles) {
      if (file === 'admin.js' || file === 'auth.js' || file === 'sse.js' || 
          file === 'admin-tools.js' || file === 'admin-endpoints.js' || file === 'endpoints.js') {
        continue;
      }

      try {
        const routePath = path.join(this.routesPath, file);
        const route = await import(`file://${routePath}?t=${Date.now()}`);

        if (route.metadata) {
          const metadata = Array.isArray(route.metadata) ? route.metadata : [route.metadata];
          
          for (const meta of metadata) {
            allEndpoints.push({
              ...meta,
              sourceFile: file,
              loadedAt: new Date().toISOString()
            });
          }

          processedFiles.push(file);
        }
      } catch (error) {
        console.error(chalk.red(`  ✗ Failed to load ${file}:`), error.message);
      }
    }

    const statusMap = await this.getStatusMapFromDatabase();
    
    const enrichedEndpoints = allEndpoints.map(endpoint => {
      const methods = endpoint.method.split(',').map(m => m.trim());
      const dbData = statusMap.get(`${endpoint.path}_${methods[0]}`);
      
      return {
        id: dbData?.id || null,
        path: endpoint.path,
        method: methods[0],
        name: endpoint.name,
        description: endpoint.description,
        category: dbData?.category || endpoint.category || 'other',
        status: dbData?.status || 'free',
        isActive: dbData?.isActive !== undefined ? dbData.isActive : true,
        requiresVIP: dbData?.status === 'vip' || dbData?.status === 'premium',
        parameters: endpoint.params || endpoint.parameters || [],
        examples: endpoint.examples || [],
        responseType: endpoint.responseType || 'json',
        responseBinary: endpoint.responseBinary || false,
        priority: dbData?.priority || endpoint.priority || 0,
        tags: dbData?.tags || endpoint.tags || [],
        rateLimit: dbData?.rateLimit || endpoint.rateLimit || 100,
        rateLimitWindow: dbData?.rateLimitWindow || endpoint.rateLimitWindow || 60,
        metadata: endpoint.metadata || {},
        sourceFile: endpoint.sourceFile,
        loadedAt: endpoint.loadedAt,
        fromDatabase: !!dbData,
        createdAt: dbData?.createdAt,
        updatedAt: dbData?.updatedAt
      };
    });

    const filteredEndpoints = includeInactive 
      ? enrichedEndpoints 
      : enrichedEndpoints.filter(ep => ep.isActive);

    this.cache.set(cacheKey, filteredEndpoints);
    this.cacheTimestamp = currentTime;

    console.log(chalk.green(`✓ Loaded ${filteredEndpoints.length} endpoints from ${processedFiles.length} route files`));
    
    return filteredEndpoints;
  }

  async getStatusMapFromDatabase() {
    const statusMap = new Map();
    
    try {
      const dbEndpoints = await ApiEndpoint.findAll({
        attributes: ['id', 'path', 'method', 'category', 'status', 'isActive', 
                     'priority', 'tags', 'rateLimit', 'rateLimitWindow', 'createdAt', 'updatedAt']
      });

      dbEndpoints.forEach(ep => {
        const key = `${ep.path}_${ep.method}`;
        statusMap.set(key, {
          id: ep.id,
          category: ep.category,
          status: ep.status,
          isActive: ep.isActive,
          priority: ep.priority,
          tags: ep.tags,
          rateLimit: ep.rateLimit,
          rateLimitWindow: ep.rateLimitWindow,
          createdAt: ep.createdAt,
          updatedAt: ep.updatedAt
        });
      });

      console.log(chalk.cyan(`📊 Loaded ${statusMap.size} endpoint statuses from database`));
    } catch (error) {
      console.error(chalk.red('Failed to load endpoint statuses from database:'), error.message);
    }

    return statusMap;
  }

  clearCache() {
    this.cache.clear();
    this.cacheTimestamp = 0;
    console.log(chalk.yellow('🗑️  Route metadata cache cleared'));
  }

  getEndpointsByCategory(category) {
    const endpoints = this.cache.get('endpoints_false') || [];
    return endpoints.filter(ep => ep.category === category);
  }

  getEndpointsByStatus(status) {
    const endpoints = this.cache.get('endpoints_false') || [];
    return endpoints.filter(ep => ep.status === status);
  }

  getVIPEndpoints() {
    const endpoints = this.cache.get('endpoints_false') || [];
    return endpoints.filter(ep => ep.requiresVIP);
  }
}

export default RouteMetadataReader;
