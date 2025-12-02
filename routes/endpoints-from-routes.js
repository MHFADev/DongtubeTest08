import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import RouteMetadataReader from '../services/RouteMetadataReader.js';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const routesPath = path.join(__dirname);
const routeReader = new RouteMetadataReader(routesPath);

router.get('/api/endpoints/from-routes', async (req, res) => {
  try {
    const {
      status,
      category,
      search,
      includeInactive = false,
      sortBy = 'priority',
      sortOrder = 'DESC'
    } = req.query;

    console.log(chalk.cyan('\n📡 Fetching endpoints from route files...'));

    let endpoints = await routeReader.getEndpointsFromRoutes(includeInactive === 'true');

    if (status) {
      endpoints = endpoints.filter(ep => ep.status === status);
    }

    if (category) {
      endpoints = endpoints.filter(ep => ep.category === category);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      endpoints = endpoints.filter(ep => 
        ep.path.toLowerCase().includes(searchLower) ||
        ep.name.toLowerCase().includes(searchLower) ||
        ep.description.toLowerCase().includes(searchLower)
      );
    }

    endpoints.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      
      if (sortOrder === 'ASC') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      total: endpoints.length,
      endpoints: endpoints,
      source: 'route-files',
      loadedAt: new Date().toISOString(),
      message: 'Endpoints loaded directly from route files with database status sync'
    });

    console.log(chalk.green(`✓ Returned ${endpoints.length} endpoints from route files`));
  } catch (error) {
    console.error(chalk.red('Error fetching endpoints from routes:'), error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch endpoints from routes',
      message: error.message
    });
  }
});

router.get('/api/endpoints/from-routes/stats', async (req, res) => {
  try {
    const endpoints = await routeReader.getEndpointsFromRoutes(true);

    const active = endpoints.filter(ep => ep.isActive).length;
    const inactive = endpoints.filter(ep => !ep.isActive).length;
    const free = endpoints.filter(ep => ep.status === 'free' && ep.isActive).length;
    const vip = endpoints.filter(ep => ep.status === 'vip' && ep.isActive).length;
    const premium = endpoints.filter(ep => ep.status === 'premium' && ep.isActive).length;
    const disabled = endpoints.filter(ep => ep.status === 'disabled').length;

    const categories = [...new Set(endpoints.map(ep => ep.category))];
    const categoryStats = categories.map(cat => ({
      name: cat,
      count: endpoints.filter(ep => ep.category === cat && ep.isActive).length
    }));

    res.json({
      success: true,
      stats: {
        total: endpoints.length,
        active,
        inactive,
        byStatus: {
          free,
          vip,
          premium,
          disabled
        },
        byCategory: categoryStats
      },
      source: 'route-files'
    });
  } catch (error) {
    console.error('Error fetching stats from routes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats from routes',
      message: error.message
    });
  }
});

router.post('/api/endpoints/from-routes/refresh', async (req, res) => {
  try {
    routeReader.clearCache();
    const endpoints = await routeReader.getEndpointsFromRoutes();
    
    res.json({
      success: true,
      message: 'Route metadata cache refreshed',
      total: endpoints.length
    });
  } catch (error) {
    console.error('Error refreshing route metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh route metadata',
      message: error.message
    });
  }
});

export default router;
