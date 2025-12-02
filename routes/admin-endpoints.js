import express from 'express';
import { ApiEndpoint, EndpointCategory, EndpointUsageStats } from '../models/index.js';
import { authenticate, authorize, refreshVIPCache } from '../middleware/auth.js';
import { Op } from 'sequelize';
import endpointEventEmitter from '../services/EndpointEventEmitter.js';

const router = express.Router();

/**
 * GET /admin/endpoints-db
 * Get all endpoints from endpoint database with advanced filtering
 */
router.get('/admin/endpoints-db', authenticate, authorize('admin'), async (req, res) => {
  try {
    const {
      search,
      status,
      category,
      isActive,
      method,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const where = {};

    if (search) {
      where[Op.or] = [
        { path: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (method) {
      where.method = method.toUpperCase();
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await ApiEndpoint.findAndCountAll({
      where,
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset
    });

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
 * POST /admin/endpoints-db
 * Create new endpoint manually
 */
router.post('/admin/endpoints-db', authenticate, authorize('admin'), async (req, res) => {
  try {
    const {
      path,
      method,
      name,
      description,
      category,
      status,
      isActive,
      parameters,
      examples,
      rateLimit,
      rateLimitWindow,
      responseType,
      responseBinary,
      priority,
      tags,
      metadata
    } = req.body;

    if (!path || !name) {
      return res.status(400).json({
        success: false,
        error: 'Path and name are required'
      });
    }

    const endpointMethod = method || 'GET';

    // Check if endpoint already exists
    const existingEndpoint = await ApiEndpoint.findOne({
      where: { path, method: endpointMethod }
    });

    if (existingEndpoint) {
      return res.status(400).json({
        success: false,
        error: 'Endpoint with this path and method already exists'
      });
    }

    const endpoint = await ApiEndpoint.create({
      path,
      method: endpointMethod,
      name,
      description: description || null,
      category: category || 'other',
      status: status || 'free',
      isActive: isActive !== undefined ? isActive : true,
      parameters: parameters || [],
      examples: examples || null,
      rateLimit: rateLimit || null,
      rateLimitWindow: rateLimitWindow || 3600000,
      responseType: responseType || 'json',
      responseBinary: responseBinary || false,
      priority: priority || 0,
      tags: tags || [],
      metadata: metadata || {}
    });

    // Invalidate VIP cache if new endpoint is VIP/Premium
    if (endpoint.status === 'vip' || endpoint.status === 'premium') {
      refreshVIPCache();
    }

    // Emit real-time event
    endpointEventEmitter.notifyEndpointChange('created', endpoint);

    res.json({
      success: true,
      message: 'Endpoint created successfully',
      endpoint
    });
  } catch (error) {
    console.error('Create endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create endpoint',
      message: error.message
    });
  }
});

/**
 * PUT /admin/endpoints-db/:id
 * Update endpoint
 */
router.put('/admin/endpoints-db/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const endpoint = await ApiEndpoint.findByPk(id);

    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }

    const oldStatus = endpoint.status;
    const oldIsActive = endpoint.isActive;
    
    await endpoint.update(updateData);

    // Invalidate VIP cache if status or isActive changed and involves VIP/Premium
    if (
      (updateData.status && updateData.status !== oldStatus) ||
      (updateData.isActive !== undefined && updateData.isActive !== oldIsActive && (endpoint.status === 'vip' || endpoint.status === 'premium'))
    ) {
      refreshVIPCache();
    }

    // Emit real-time event
    endpointEventEmitter.notifyEndpointChange('updated', endpoint);

    res.json({
      success: true,
      message: 'Endpoint updated successfully',
      endpoint
    });
  } catch (error) {
    console.error('Update endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update endpoint',
      message: error.message
    });
  }
});

/**
 * DELETE /admin/endpoints-db/:id
 * Delete endpoint
 */
router.delete('/admin/endpoints-db/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const endpoint = await ApiEndpoint.findByPk(id);

    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }

    const deletedEndpoint = endpoint.toJSON();
    await endpoint.destroy();

    // Invalidate VIP cache if deleted endpoint was VIP/Premium
    if (endpoint.status === 'vip' || endpoint.status === 'premium') {
      refreshVIPCache();
    }

    // Emit real-time event
    endpointEventEmitter.notifyEndpointChange('deleted', deletedEndpoint);

    res.json({
      success: true,
      message: 'Endpoint deleted successfully'
    });
  } catch (error) {
    console.error('Delete endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete endpoint',
      message: error.message
    });
  }
});

/**
 * PUT /admin/endpoints-db/:id/toggle-status
 * Toggle endpoint status (free <-> vip)
 */
router.put('/admin/endpoints-db/:id/toggle-status', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['free', 'vip', 'premium', 'disabled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be free, vip, premium, or disabled'
      });
    }

    const endpoint = await ApiEndpoint.findByPk(id);

    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }

    await endpoint.update({ status });

    // Invalidate VIP cache immediately
    refreshVIPCache();

    // Emit real-time event
    endpointEventEmitter.notifyEndpointChange('status_changed', endpoint);

    res.json({
      success: true,
      message: `Endpoint status changed to ${status}`,
      endpoint,
      realtime: true
    });
  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle endpoint status',
      message: error.message
    });
  }
});

/**
 * PUT /admin/endpoints-db/:id/toggle-active
 * Toggle endpoint active/inactive
 */
router.put('/admin/endpoints-db/:id/toggle-active', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const endpoint = await ApiEndpoint.findByPk(id);

    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }

    await endpoint.update({ isActive: !endpoint.isActive });

    // Invalidate VIP cache if endpoint is VIP/Premium (isActive affects VIP access)
    if (endpoint.status === 'vip' || endpoint.status === 'premium') {
      refreshVIPCache();
    }

    // Emit real-time event
    endpointEventEmitter.notifyEndpointChange('active_toggled', endpoint);

    res.json({
      success: true,
      message: `Endpoint ${endpoint.isActive ? 'activated' : 'deactivated'}`,
      endpoint,
      realtime: true
    });
  } catch (error) {
    console.error('Toggle active error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle endpoint active status',
      message: error.message
    });
  }
});

/**
 * POST /admin/endpoints-db/bulk-update-status
 * Bulk update endpoint status
 */
router.post('/admin/endpoints-db/bulk-update-status', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { endpointIds, status } = req.body;

    if (!Array.isArray(endpointIds) || endpointIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'endpointIds array is required'
      });
    }

    if (!['free', 'vip', 'premium', 'disabled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const updated = await ApiEndpoint.update(
      { status },
      {
        where: {
          id: {
            [Op.in]: endpointIds
          }
        }
      }
    );

    // Invalidate VIP cache immediately
    refreshVIPCache();

    // Emit real-time event for bulk update
    endpointEventEmitter.notifyBulkChange('bulk_status_update', updated[0]);

    res.json({
      success: true,
      message: `${updated[0]} endpoints updated to ${status}`,
      updated: updated[0],
      realtime: true
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update endpoints',
      message: error.message
    });
  }
});

/**
 * POST /admin/endpoints-db/sync
 * Manually trigger sync from route files
 */
router.post('/admin/endpoints-db/sync', authenticate, authorize('admin'), async (req, res) => {
  try {
    // Import sync service
    const EndpointSyncService = (await import('../services/EndpointSyncService.js')).default;
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const routesPath = path.join(__dirname, '..', 'routes');

    const syncService = new EndpointSyncService(routesPath);
    const result = await syncService.syncRoutesToDatabase();

    if (result.success) {
      // Emit real-time event for sync completion
      endpointEventEmitter.notifySyncComplete(result);
      
      res.json({
        success: true,
        message: 'Endpoints synced successfully',
        result,
        realtime: true
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Sync failed',
        result
      });
    }
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync endpoints',
      message: error.message
    });
  }
});

/**
 * GET /admin/endpoints-db/stats
 * Get endpoint statistics
 */
router.get('/admin/endpoints-db/stats', authenticate, authorize('admin'), async (req, res) => {
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

    const recentEndpoints = await ApiEndpoint.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5,
      attributes: ['id', 'path', 'method', 'name', 'status', 'createdAt']
    });

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
        byCategory: categoryStats,
        recentEndpoints
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
 * GET /admin/categories
 * Get all categories with management info
 */
router.get('/admin/categories', authenticate, authorize('admin'), async (req, res) => {
  try {
    const categories = await EndpointCategory.findAll({
      order: [['priority', 'DESC']]
    });

    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const count = await ApiEndpoint.count({
          where: { category: cat.name }
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
 * POST /admin/categories
 * Create new category
 */
router.post('/admin/categories', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, displayName, description, icon, color, priority } = req.body;

    if (!name || !displayName) {
      return res.status(400).json({
        success: false,
        error: 'Name and displayName are required'
      });
    }

    const category = await EndpointCategory.create({
      name,
      displayName,
      description: description || null,
      icon: icon || null,
      color: color || null,
      priority: priority || 0,
      isActive: true
    });

    res.json({
      success: true,
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create category',
      message: error.message
    });
  }
});

/**
 * PUT /admin/categories/:id
 * Update category
 */
router.put('/admin/categories/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const category = await EndpointCategory.findByPk(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    await category.update(updateData);

    res.json({
      success: true,
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update category',
      message: error.message
    });
  }
});

/**
 * DELETE /admin/categories/:id
 * Delete category
 */
router.delete('/admin/categories/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const category = await EndpointCategory.findByPk(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    // Check if category has endpoints
    const endpointCount = await ApiEndpoint.count({
      where: { category: category.name }
    });

    if (endpointCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete category with ${endpointCount} endpoints. Reassign them first.`
      });
    }

    await category.destroy();

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete category',
      message: error.message
    });
  }
});

export default router;
