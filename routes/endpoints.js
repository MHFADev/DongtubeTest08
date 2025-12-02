import { Router } from 'express';
import { ApiEndpoint, EndpointCategory } from '../models/index.js';
import { Op } from 'sequelize';

const router = Router();

/**
 * GET /api/endpoints
 * Get all active endpoints from database (for frontend)
 * Supports filtering by status, category, search, etc.
 */
router.get('/api/endpoints', async (req, res) => {
  try {
    const {
      status,
      category,
      search,
      isActive,
      page = 1,
      limit = 1000,
      sortBy = 'priority',
      sortOrder = 'DESC'
    } = req.query;

    const where = {};

    // Filter by status (free, vip, premium, disabled)
    if (status) {
      where.status = status;
    }

    // Filter by category
    if (category) {
      where.category = category;
    }

    // Filter by active status
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    } else {
      // By default, only show active endpoints
      where.isActive = true;
    }

    // Search in path, name, description
    if (search) {
      where[Op.or] = [
        { path: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await ApiEndpoint.findAndCountAll({
      where,
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset,
      attributes: [
        'id', 'path', 'method', 'name', 'description', 'category',
        'status', 'isActive', 'parameters', 'examples', 'responseType',
        'responseBinary', 'priority', 'tags', 'rateLimit', 'createdAt'
      ]
    });

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / parseInt(limit)),
      endpoints: rows
    });
  } catch (error) {
    console.error('Get endpoints error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch endpoints',
      message: error.message
    });
  }
});

/**
 * GET /api/endpoints/categories
 * Get all endpoint categories
 */
router.get('/api/endpoints/categories', async (req, res) => {
  try {
    const categories = await EndpointCategory.findAll({
      where: { isActive: true },
      order: [['priority', 'DESC']],
      attributes: ['id', 'name', 'displayName', 'description', 'icon', 'color', 'priority']
    });

    // Get count of endpoints per category
    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const count = await ApiEndpoint.count({
          where: {
            category: cat.name,
            isActive: true
          }
        });

        return {
          ...cat.toJSON(),
          endpointCount: count
        };
      })
    );

    res.json({
      success: true,
      total: categoriesWithCount.length,
      categories: categoriesWithCount
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
      message: error.message
    });
  }
});

/**
 * GET /api/endpoints/version
 * Get current data version for polling/change detection
 */
router.get('/api/endpoints/version', async (req, res) => {
  try {
    // Calculate version based on latest update timestamp
    const latestEndpoint = await ApiEndpoint.findOne({
      order: [['updatedAt', 'DESC']],
      attributes: ['updatedAt']
    });

    const version = latestEndpoint 
      ? new Date(latestEndpoint.updatedAt).getTime()
      : Date.now();

    const total = await ApiEndpoint.count({ where: { isActive: true } });

    res.json({
      success: true,
      version,
      timestamp: new Date().toISOString(),
      totalEndpoints: total
    });
  } catch (error) {
    console.error('Get version error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch version',
      message: error.message
    });
  }
});

/**
 * GET /api/endpoints/stats
 * Get endpoint statistics
 */
router.get('/api/endpoints/stats', async (req, res) => {
  try {
    const total = await ApiEndpoint.count();
    const active = await ApiEndpoint.count({ where: { isActive: true } });
    const free = await ApiEndpoint.count({ where: { status: 'free', isActive: true } });
    const vip = await ApiEndpoint.count({ where: { status: 'vip', isActive: true } });
    const premium = await ApiEndpoint.count({ where: { status: 'premium', isActive: true } });
    const disabled = await ApiEndpoint.count({ where: { status: 'disabled' } });

    const categories = await EndpointCategory.findAll({
      where: { isActive: true },
      attributes: ['name', 'displayName']
    });

    const categoryStats = await Promise.all(
      categories.map(async (cat) => {
        const count = await ApiEndpoint.count({
          where: { category: cat.name, isActive: true }
        });
        return {
          name: cat.name,
          displayName: cat.displayName,
          count
        };
      })
    );

    res.json({
      success: true,
      stats: {
        total,
        active,
        inactive: total - active,
        byStatus: {
          free,
          vip,
          premium,
          disabled
        },
        byCategory: categoryStats
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      message: error.message
    });
  }
});

/**
 * GET /api/endpoints/:id
 * Get single endpoint details
 */
router.get('/api/endpoints/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const endpoint = await ApiEndpoint.findByPk(id);

    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }

    res.json({
      success: true,
      endpoint
    });
  } catch (error) {
    console.error('Get endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch endpoint',
      message: error.message
    });
  }
});

/**
 * GET /api/endpoints/by-path
 * Get endpoint by path and method
 */
router.get('/api/endpoints/by-path', async (req, res) => {
  try {
    const { path, method = 'GET' } = req.query;

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Path parameter is required'
      });
    }

    const endpoint = await ApiEndpoint.findOne({
      where: { path, method: method.toUpperCase() }
    });

    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }

    res.json({
      success: true,
      endpoint
    });
  } catch (error) {
    console.error('Get endpoint by path error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch endpoint',
      message: error.message
    });
  }
});

export default router;
