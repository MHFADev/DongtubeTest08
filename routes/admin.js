import express from 'express';
import { User, VersionHistory, ActivityLog, RateLimitConfig, NotificationConfig, IpWhitelist } from '../models/index.js';
import { ApiEndpoint } from '../models/endpoint/index.js';
import { authenticate, authorize, refreshVIPCache } from '../middleware/auth.js';
import { roleChangeEmitter } from '../services/EventEmitter.js';
import { logActivity } from '../middleware/activityLogger.js';
import NotificationService from '../services/NotificationService.js';
import { refreshRateLimitCache } from '../middleware/dynamicRateLimit.js';
import { Op } from 'sequelize';
import os from 'os';
import papaparse from 'papaparse';

const router = express.Router();

router.get('/admin/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { search, role, vipStatus, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
    
    const where = {};
    
    if (search) {
      where[Op.or] = [
        { email: { [Op.like]: `%${search}%` } },
        { id: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (role) {
      where.role = role;
    }
    
    if (vipStatus !== undefined) {
      if (vipStatus === 'active') {
        where.role = 'vip';
        where.vipExpiresAt = { [Op.or]: [{ [Op.gt]: new Date() }, null] };
      } else if (vipStatus === 'expired') {
        where.role = 'vip';
        where.vipExpiresAt = { [Op.lt]: new Date() };
      }
    }
    
    if (dateFrom) {
      where.createdAt = { [Op.gte]: new Date(dateFrom) };
    }
    
    if (dateTo) {
      where.createdAt = { ...where.createdAt, [Op.lte]: new Date(dateTo) };
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: ['id', 'email', 'role', 'vipExpiresAt', 'createdAt', 'lastLogin'],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / parseInt(limit)),
      users: rows
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

router.put('/admin/users/:id/role', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'vip', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be user, vip, or admin'
      });
    }

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const oldRole = user.role;
    await user.update({ role });

    console.log(`👤 ADMIN: Updated user ${user.email} role from ${oldRole} to ${role}`);
    
    roleChangeEmitter.notifyRoleChange(user.id, oldRole, role, user.vipExpiresAt);

    res.json({
      success: true,
      message: 'User role updated successfully - Real-time notification sent!',
      refreshTokenRequired: true,
      realtimeUpdate: true,
      instruction: 'User will be automatically notified if connected to SSE stream',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user role'
    });
  }
});

router.post('/admin/users/:id/grant-vip', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { duration } = req.body;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const now = new Date();
    let expiresAt = new Date();

    switch (duration) {
      case '7d':
        expiresAt.setDate(now.getDate() + 7);
        break;
      case '30d':
        expiresAt.setDate(now.getDate() + 30);
        break;
      case '90d':
        expiresAt.setDate(now.getDate() + 90);
        break;
      case '1y':
        expiresAt.setFullYear(now.getFullYear() + 1);
        break;
      case 'lifetime':
        expiresAt = new Date('2099-12-31');
        break;
      case 'permanent':
        expiresAt = null;
        break;
      default:
        if (req.body.customDate) {
          expiresAt = new Date(req.body.customDate);
        } else {
          expiresAt.setDate(now.getDate() + 30);
        }
    }

    await user.update({ 
      role: 'vip',
      vipExpiresAt: expiresAt 
    });

    console.log(`⭐ ADMIN: Granted VIP access to ${user.email} until ${expiresAt || 'permanent'}`);
    
    roleChangeEmitter.notifyVIPGranted(user.id, user.email, expiresAt);

    res.json({
      success: true,
      message: 'VIP access granted successfully - Real-time notification sent!',
      refreshTokenRequired: true,
      realtimeUpdate: true,
      instruction: 'User will be automatically notified and access activated in real-time',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        vipExpiresAt: user.vipExpiresAt
      }
    });
  } catch (error) {
    console.error('Grant VIP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to grant VIP access'
    });
  }
});

router.put('/admin/users/:id/force-update', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role, vipExpiresAt } = req.body;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const oldRole = user.role;
    const oldVipExpiresAt = user.vipExpiresAt;

    const updates = {};
    if (role !== undefined) {
      updates.role = role;
    }
    if (vipExpiresAt !== undefined) {
      updates.vipExpiresAt = vipExpiresAt === null ? null : new Date(vipExpiresAt);
    }

    await user.update(updates);

    console.log(`👤 ADMIN: Force updated user ${user.email} - Role: ${oldRole} → ${user.role}`);
    
    if (role !== undefined && oldRole !== user.role) {
      roleChangeEmitter.notifyRoleChange(user.id, oldRole, user.role, user.vipExpiresAt);
    }

    res.json({
      success: true,
      message: 'User forcefully updated by admin - Real-time notification sent!',
      refreshTokenRequired: true,
      realtimeUpdate: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        vipExpiresAt: user.vipExpiresAt
      }
    });
  } catch (error) {
    console.error('Force update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to force update user'
    });
  }
});

router.post('/admin/users/bulk-update', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { userIds, role, vipExpiresAt } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userIds array is required and must not be empty'
      });
    }

    const updates = {};
    if (role !== undefined) {
      updates.role = role;
    }
    if (vipExpiresAt !== undefined) {
      updates.vipExpiresAt = vipExpiresAt === null ? null : new Date(vipExpiresAt);
    }

    const [updatedCount] = await User.update(updates, {
      where: { id: userIds }
    });

    res.json({
      success: true,
      message: `${updatedCount} users updated by admin - no restrictions applied`,
      updatedCount,
      updates
    });
  } catch (error) {
    console.error('Bulk update users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update users'
    });
  }
});

router.post('/admin/users/:id/revoke-vip', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await user.update({ 
      role: 'user',
      vipExpiresAt: null 
    });

    console.log(`🚫 ADMIN: Revoked VIP access from ${user.email}`);
    
    roleChangeEmitter.notifyVIPRevoked(user.id, user.email);

    res.json({
      success: true,
      message: 'VIP access revoked successfully - Real-time notification sent!',
      refreshTokenRequired: true,
      realtimeUpdate: true,
      instruction: 'User will be automatically notified in real-time',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        vipExpiresAt: user.vipExpiresAt
      }
    });
  } catch (error) {
    console.error('Revoke VIP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke VIP access'
    });
  }
});

router.put('/admin/users/:id/extend-vip', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { extendBy, customDate } = req.body;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const currentExpiry = user.vipExpiresAt ? new Date(user.vipExpiresAt) : new Date();
    let newExpiresAt;

    if (customDate) {
      newExpiresAt = new Date(customDate);
    } else {
      newExpiresAt = new Date(currentExpiry);
      
      switch (extendBy) {
        case '7d':
          newExpiresAt.setDate(currentExpiry.getDate() + 7);
          break;
        case '30d':
          newExpiresAt.setDate(currentExpiry.getDate() + 30);
          break;
        case '90d':
          newExpiresAt.setDate(currentExpiry.getDate() + 90);
          break;
        case '1y':
          newExpiresAt.setFullYear(currentExpiry.getFullYear() + 1);
          break;
        default:
          newExpiresAt.setDate(currentExpiry.getDate() + 30);
      }
    }

    await user.update({ 
      role: 'vip',
      vipExpiresAt: newExpiresAt 
    });

    res.json({
      success: true,
      message: 'VIP access extended successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        vipExpiresAt: user.vipExpiresAt
      }
    });
  } catch (error) {
    console.error('Extend VIP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extend VIP access'
    });
  }
});

router.get('/admin/vip-endpoints', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { search, requiresVIP, category, method, page = 1, limit = 50 } = req.query;
    
    const where = {};
    
    if (search) {
      where[Op.or] = [
        { path: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (requiresVIP !== undefined) {
      where.status = requiresVIP === 'true' ? { [Op.in]: ['vip', 'premium'] } : 'free';
    }
    
    if (category) {
      where.category = category;
    }
    
    if (method) {
      where.method = method.toUpperCase();
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await ApiEndpoint.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
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
    console.error('Get VIP endpoints error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch VIP endpoints'
    });
  }
});

router.post('/admin/vip-endpoints', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { path, method, description, requiresVIP, name, category } = req.body;

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Endpoint path is required'
      });
    }

    const endpointMethod = method || 'GET';

    const existingEndpoint = await ApiEndpoint.findOne({ 
      where: { path, method: endpointMethod } 
    });

    if (existingEndpoint) {
      const status = requiresVIP !== undefined ? (requiresVIP ? 'vip' : 'free') : 'vip';
      await existingEndpoint.update({ 
        status: status,
        description: description || existingEndpoint.description,
        name: name !== undefined ? name : existingEndpoint.name,
        category: category !== undefined ? category : existingEndpoint.category
      });

      refreshVIPCache();

      return res.json({
        success: true,
        message: 'VIP endpoint updated',
        endpoint: existingEndpoint
      });
    }

    const status = requiresVIP !== undefined ? (requiresVIP ? 'vip' : 'free') : 'vip';
    const endpoint = await ApiEndpoint.create({
      path,
      method: endpointMethod,
      description: description || null,
      status: status,
      name: name || null,
      category: category || null
    });

    refreshVIPCache();

    res.status(201).json({
      success: true,
      message: 'VIP endpoint created',
      endpoint
    });
  } catch (error) {
    console.error('Create VIP endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create VIP endpoint'
    });
  }
});

router.delete('/admin/vip-endpoints/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const endpoint = await ApiEndpoint.findByPk(id);

    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'VIP endpoint not found'
      });
    }

    await endpoint.destroy();
    refreshVIPCache();

    res.json({
      success: true,
      message: 'VIP endpoint deleted'
    });
  } catch (error) {
    console.error('Delete VIP endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete VIP endpoint'
    });
  }
});

router.get('/admin/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const totalUsers = await User.count();
    const vipUsers = await User.count({ where: { role: 'vip' } });
    const adminUsers = await User.count({ where: { role: 'admin' } });
    const regularUsers = await User.count({ where: { role: 'user' } });
    const totalVIPEndpoints = await ApiEndpoint.count({ where: { status: { [Op.in]: ['vip', 'premium'] } } });
    const totalEndpoints = await ApiEndpoint.count();

    res.json({
      success: true,
      stats: {
        totalUsers,
        vipUsers,
        adminUsers,
        regularUsers,
        totalVIPEndpoints,
        totalEndpoints,
        freeEndpoints: totalEndpoints - totalVIPEndpoints
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

router.get('/admin/endpoints/all', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { premium, search, category, page = 1, limit = 50 } = req.query;
    
    const where = {};
    
    if (premium !== undefined) {
      where.status = premium === 'true' ? { [Op.in]: ['vip', 'premium'] } : 'free';
    }
    
    if (search) {
      where[Op.or] = [
        { path: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (category) {
      where.category = category;
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await ApiEndpoint.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });
    
    const endpointsWithRequiresVIP = rows.map(ep => ({
      ...ep.toJSON(),
      requiresVIP: ['vip', 'premium'].includes(ep.status)
    }));
    
    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / parseInt(limit)),
      endpoints: endpointsWithRequiresVIP
    });
  } catch (error) {
    console.error('Get all endpoints error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch endpoints'
    });
  }
});

router.put('/admin/endpoints/:id/toggle-premium', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const endpoint = await ApiEndpoint.findByPk(id);
    
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }
    
    const oldStatus = endpoint.status;
    const newStatus = ['vip', 'premium'].includes(endpoint.status) ? 'free' : 'vip';
    await endpoint.update({
      status: newStatus
    });
    
    console.log(`\n🔧 ADMIN: Toggled endpoint "${endpoint.path}" (${endpoint.method})`);
    console.log(`   Status changed: ${oldStatus.toUpperCase()} → ${newStatus.toUpperCase()}`);
    
    refreshVIPCache();
    
    res.json({
      success: true,
      message: `Endpoint ${['vip', 'premium'].includes(newStatus) ? 'set to PREMIUM' : 'set to FREE'}`,
      endpoint: {
        id: endpoint.id,
        path: endpoint.path,
        name: endpoint.name,
        status: newStatus,
        requiresVIP: ['vip', 'premium'].includes(newStatus)
      }
    });
  } catch (error) {
    console.error('Toggle premium error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle premium status'
    });
  }
});

router.put('/admin/endpoints/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { requiresVIP, description, category, name } = req.body;
    
    const endpoint = await ApiEndpoint.findByPk(id);
    
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }
    
    const updates = {};
    if (requiresVIP !== undefined) updates.status = requiresVIP ? 'vip' : 'free';
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (name !== undefined) updates.name = name;
    
    await endpoint.update(updates);
    
    refreshVIPCache();
    
    res.json({
      success: true,
      message: 'Endpoint updated successfully',
      endpoint
    });
  } catch (error) {
    console.error('Update endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update endpoint'
    });
  }
});

router.post('/admin/endpoints/bulk-premium', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { ids, requiresVIP } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ids array is required and must not be empty'
      });
    }
    
    if (requiresVIP === undefined) {
      return res.status(400).json({
        success: false,
        error: 'requiresVIP field is required'
      });
    }
    
    const status = requiresVIP ? 'vip' : 'free';
    const updated = await ApiEndpoint.update(
      { status },
      { where: { id: ids } }
    );
    
    refreshVIPCache();
    
    res.json({
      success: true,
      message: `${updated[0]} endpoints updated`,
      updated: updated[0],
      status: requiresVIP ? 'PREMIUM' : 'FREE'
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update endpoints'
    });
  }
});

router.post('/admin/cache/refresh', authenticate, authorize('admin'), async (req, res) => {
  try {
    refreshVIPCache();
    
    res.json({
      success: true,
      message: 'VIP cache refreshed successfully'
    });
  } catch (error) {
    console.error('Refresh cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh cache'
    });
  }
});

router.get('/admin/categories', authenticate, authorize('admin'), async (req, res) => {
  try {
    const categories = await ApiEndpoint.findAll({
      attributes: ['category'],
      where: {
        category: { [Op.ne]: null }
      },
      group: ['category']
    });
    
    const uniqueCategories = [...new Set(categories.map(c => c.category).filter(Boolean))];
    
    res.json({
      success: true,
      categories: uniqueCategories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

router.get('/admin/endpoints/category/:category', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await ApiEndpoint.findAndCountAll({
      where: { category },
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      category,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / parseInt(limit)),
      endpoints: rows
    });
  } catch (error) {
    console.error('Get endpoints by category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch endpoints by category'
    });
  }
});

router.post('/admin/reload/trigger', authenticate, authorize('admin'), async (req, res) => {
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  
  if (isServerless) {
    return res.status(501).json({
      success: false,
      error: 'Route reload not supported in serverless environment',
      message: 'Hot-reload is disabled on Vercel. Redeploy the application to update routes.',
      serverless_mode: true
    });
  }
  
  try {
    const { routeManager } = await import('../server.js');
    
    if (!routeManager) {
      return res.status(503).json({
        success: false,
        error: 'RouteManager not available',
        message: 'Route management features are disabled'
      });
    }
    
    console.log('\n🔄 Admin triggered manual route reload...\n');
    
    const result = await routeManager.reload();
    
    if (result.success) {
      return res.json({
        success: true,
        message: 'Routes reloaded successfully',
        duration: result.duration,
        totalEndpoints: result.totalEndpoints,
        timestamp: new Date().toISOString()
      });
    } else if (result.skipped) {
      return res.status(409).json({
        success: false,
        message: 'Reload already in progress',
        skipped: true
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Route reload failed',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Manual reload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger route reload',
      details: error.message
    });
  }
});

router.get('/admin/reload/status', authenticate, authorize('admin'), async (req, res) => {
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  
  if (isServerless) {
    return res.json({
      success: true,
      serverless_mode: true,
      status: {
        currentStatus: 'n/a (serverless)',
        isReloading: false,
        totalEndpoints: 0,
        message: 'Hot-reload is disabled in serverless environment'
      }
    });
  }
  
  try {
    const { routeManager } = await import('../server.js');
    
    if (!routeManager) {
      return res.json({
        success: true,
        status: {
          currentStatus: 'unavailable',
          isReloading: false,
          message: 'RouteManager not initialized'
        }
      });
    }
    
    const status = routeManager.getStatus();
    
    res.json({
      success: true,
      status: {
        currentStatus: status.status,
        isReloading: status.isReloading,
        totalEndpoints: status.totalEndpoints,
        lastReloadTime: status.lastReloadTime,
        lastError: status.lastError,
        statistics: {
          totalReloads: status.stats.totalReloads,
          successfulReloads: status.stats.successfulReloads,
          failedReloads: status.stats.failedReloads,
          lastReloadDuration: status.stats.lastReloadDuration
        }
      }
    });
  } catch (error) {
    console.error('Get reload status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reload status',
      details: error.message
    });
  }
});

router.get('/admin/config/version', authenticate, authorize('admin'), async (req, res) => {
  try {
    const latestVersion = await VersionHistory.findOne({
      order: [['createdAt', 'DESC']]
    });

    await logActivity(req.user.id, 'VIEW_VERSION_CONFIG', 'version', null, {}, req);

    res.json({
      success: true,
      version: latestVersion || { version: '1.0.0', name: 'Initial', description: 'No version history' }
    });
  } catch (error) {
    console.error('Get version error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch version info'
    });
  }
});

router.put('/admin/config/version', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { version, name, description } = req.body;

    if (!version) {
      return res.status(400).json({
        success: false,
        error: 'Version is required'
      });
    }

    const newVersion = await VersionHistory.create({
      version,
      name: name || null,
      description: description || null,
      changedBy: req.user.id
    });

    await logActivity(req.user.id, 'UPDATE_VERSION', 'version', newVersion.id, {
      version,
      name,
      description
    }, req);

    res.json({
      success: true,
      message: 'Version updated successfully',
      version: newVersion
    });
  } catch (error) {
    console.error('Update version error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update version'
    });
  }
});

router.get('/admin/config/version/history', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await VersionHistory.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    await logActivity(req.user.id, 'VIEW_VERSION_HISTORY', 'version', null, {}, req);

    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / parseInt(limit)),
      history: rows
    });
  } catch (error) {
    console.error('Get version history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch version history'
    });
  }
});

router.post('/admin/config/version/rollback/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const targetVersion = await VersionHistory.findByPk(id);

    if (!targetVersion) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }

    const newVersion = await VersionHistory.create({
      version: targetVersion.version,
      name: `Rollback to ${targetVersion.version}`,
      description: `Rolled back from version history ID ${id}`,
      changedBy: req.user.id
    });

    await logActivity(req.user.id, 'ROLLBACK_VERSION', 'version', newVersion.id, {
      targetVersionId: id,
      targetVersion: targetVersion.version
    }, req);

    res.json({
      success: true,
      message: 'Version rolled back successfully',
      version: newVersion
    });
  } catch (error) {
    console.error('Rollback version error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rollback version'
    });
  }
});

router.get('/admin/logs', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, dateFrom, dateTo, userId, action } = req.query;
    
    const where = {};
    
    if (userId) {
      where.userId = userId;
    }
    
    if (action) {
      where.action = action;
    }
    
    if (dateFrom) {
      where.createdAt = { [Op.gte]: new Date(dateFrom) };
    }
    
    if (dateTo) {
      where.createdAt = { ...where.createdAt, [Op.lte]: new Date(dateTo) };
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await ActivityLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / parseInt(limit)),
      logs: rows
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity logs'
    });
  }
});

router.get('/admin/logs/export', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { dateFrom, dateTo, userId, action } = req.query;
    
    const where = {};
    
    if (userId) {
      where.userId = userId;
    }
    
    if (action) {
      where.action = action;
    }
    
    if (dateFrom) {
      where.createdAt = { [Op.gte]: new Date(dateFrom) };
    }
    
    if (dateTo) {
      where.createdAt = { ...where.createdAt, [Op.lte]: new Date(dateTo) };
    }
    
    const logs = await ActivityLog.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 10000
    });

    await logActivity(req.user.id, 'EXPORT_LOGS', 'logs', null, {
      count: logs.length,
      filters: { dateFrom, dateTo, userId, action }
    }, req);

    res.json({
      success: true,
      total: logs.length,
      exportedAt: new Date().toISOString(),
      logs
    });
  } catch (error) {
    console.error('Export logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export logs'
    });
  }
});

router.delete('/admin/logs/cleanup', authenticate, authorize('admin'), async (req, res) => {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const deletedCount = await ActivityLog.destroy({
      where: {
        createdAt: { [Op.lt]: ninetyDaysAgo }
      }
    });

    await logActivity(req.user.id, 'CLEANUP_LOGS', 'logs', null, {
      deletedCount,
      beforeDate: ninetyDaysAgo
    }, req);

    res.json({
      success: true,
      message: `${deletedCount} old logs deleted successfully`,
      deletedCount,
      beforeDate: ninetyDaysAgo
    });
  } catch (error) {
    console.error('Cleanup logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup logs'
    });
  }
});

router.get('/admin/analytics', authenticate, authorize('admin'), async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalUsers = await User.count();
    const newUsersLast30Days = await User.count({
      where: { createdAt: { [Op.gte]: thirtyDaysAgo } }
    });
    const newUsersLast7Days = await User.count({
      where: { createdAt: { [Op.gte]: sevenDaysAgo } }
    });

    const vipUsers = await User.count({ where: { role: 'vip' } });
    const activeVipUsers = await User.count({
      where: {
        role: 'vip',
        [Op.or]: [
          { vipExpiresAt: { [Op.gt]: now } },
          { vipExpiresAt: null }
        ]
      }
    });

    const totalEndpoints = await ApiEndpoint.count();
    const premiumEndpoints = await ApiEndpoint.count({ where: { status: { [Op.in]: ['vip', 'premium'] } } });

    const topActions = await ActivityLog.findAll({
      attributes: [
        'action',
        [ActivityLog.sequelize.fn('COUNT', ActivityLog.sequelize.col('id')), 'count']
      ],
      where: {
        createdAt: { [Op.gte]: thirtyDaysAgo }
      },
      group: ['action'],
      order: [[ActivityLog.sequelize.fn('COUNT', ActivityLog.sequelize.col('id')), 'DESC']],
      limit: 10
    });

    const hourlyActivity = await ActivityLog.findAll({
      attributes: [
        [ActivityLog.sequelize.fn('EXTRACT', ActivityLog.sequelize.literal('HOUR FROM "createdAt"')), 'hour'],
        [ActivityLog.sequelize.fn('COUNT', ActivityLog.sequelize.col('id')), 'count']
      ],
      where: {
        createdAt: { [Op.gte]: sevenDaysAgo }
      },
      group: [ActivityLog.sequelize.fn('EXTRACT', ActivityLog.sequelize.literal('HOUR FROM "createdAt"'))],
      order: [[ActivityLog.sequelize.fn('COUNT', ActivityLog.sequelize.col('id')), 'DESC']]
    });

    await logActivity(req.user.id, 'VIEW_ANALYTICS', 'analytics', null, {}, req);

    res.json({
      success: true,
      analytics: {
        users: {
          total: totalUsers,
          newLast30Days: newUsersLast30Days,
          newLast7Days: newUsersLast7Days,
          vipTotal: vipUsers,
          vipActive: activeVipUsers,
          vipConversionRate: totalUsers > 0 ? ((vipUsers / totalUsers) * 100).toFixed(2) : 0
        },
        endpoints: {
          total: totalEndpoints,
          premium: premiumEndpoints,
          free: totalEndpoints - premiumEndpoints
        },
        activity: {
          topActions,
          peakHours: hourlyActivity
        }
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

router.get('/admin/analytics/endpoints', authenticate, authorize('admin'), async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const endpointUsage = await ActivityLog.findAll({
      attributes: [
        'targetType',
        'action',
        [ActivityLog.sequelize.fn('COUNT', ActivityLog.sequelize.col('id')), 'count']
      ],
      where: {
        createdAt: { [Op.gte]: thirtyDaysAgo },
        targetType: { [Op.ne]: null }
      },
      group: ['targetType', 'action'],
      order: [[ActivityLog.sequelize.fn('COUNT', ActivityLog.sequelize.col('id')), 'DESC']],
      limit: 20
    });

    res.json({
      success: true,
      endpointUsage
    });
  } catch (error) {
    console.error('Get endpoint analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch endpoint analytics'
    });
  }
});

router.get('/admin/analytics/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const userGrowth = await User.findAll({
      attributes: [
        [User.sequelize.fn('DATE', User.sequelize.col('createdAt')), 'date'],
        [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']
      ],
      where: {
        createdAt: { [Op.gte]: thirtyDaysAgo }
      },
      group: [User.sequelize.fn('DATE', User.sequelize.col('createdAt'))],
      order: [[User.sequelize.fn('DATE', User.sequelize.col('createdAt')), 'ASC']]
    });

    const roleDistribution = await User.findAll({
      attributes: [
        'role',
        [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']
      ],
      group: ['role']
    });

    res.json({
      success: true,
      userGrowth,
      roleDistribution
    });
  } catch (error) {
    console.error('Get user analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user analytics'
    });
  }
});

router.post('/admin/bulk/update-roles', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { userIds, role } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userIds array is required and must not be empty'
      });
    }

    if (!['user', 'vip', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be user, vip, or admin'
      });
    }

    const [updatedCount] = await User.update(
      { role },
      { where: { id: userIds } }
    );

    await logActivity(req.user.id, 'BULK_UPDATE_ROLES', 'user', null, {
      userIds,
      role,
      updatedCount
    }, req);

    res.json({
      success: true,
      message: `${updatedCount} users updated successfully`,
      updatedCount,
      role
    });
  } catch (error) {
    console.error('Bulk update roles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update roles'
    });
  }
});

router.post('/admin/bulk/grant-vip', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { userIds, duration, customDate } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userIds array is required and must not be empty'
      });
    }

    const now = new Date();
    let expiresAt = new Date();

    switch (duration) {
      case '7d':
        expiresAt.setDate(now.getDate() + 7);
        break;
      case '30d':
        expiresAt.setDate(now.getDate() + 30);
        break;
      case '90d':
        expiresAt.setDate(now.getDate() + 90);
        break;
      case '1y':
        expiresAt.setFullYear(now.getFullYear() + 1);
        break;
      case 'lifetime':
        expiresAt = new Date('2099-12-31');
        break;
      case 'permanent':
        expiresAt = null;
        break;
      default:
        if (customDate) {
          expiresAt = new Date(customDate);
        } else {
          expiresAt.setDate(now.getDate() + 30);
        }
    }

    const [updatedCount] = await User.update(
      { role: 'vip', vipExpiresAt: expiresAt },
      { where: { id: userIds } }
    );

    await logActivity(req.user.id, 'BULK_GRANT_VIP', 'user', null, {
      userIds,
      duration,
      expiresAt,
      updatedCount
    }, req);

    res.json({
      success: true,
      message: `VIP access granted to ${updatedCount} users`,
      updatedCount,
      vipExpiresAt: expiresAt
    });
  } catch (error) {
    console.error('Bulk grant VIP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk grant VIP'
    });
  }
});

router.post('/admin/bulk/delete-users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userIds array is required and must not be empty'
      });
    }

    const adminCount = await User.count({
      where: {
        id: userIds,
        role: 'admin'
      }
    });

    if (adminCount > 0) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete admin users'
      });
    }

    const deletedCount = await User.destroy({
      where: { id: userIds }
    });

    await logActivity(req.user.id, 'BULK_DELETE_USERS', 'user', null, {
      userIds,
      deletedCount
    }, req);

    res.json({
      success: true,
      message: `${deletedCount} users deleted successfully`,
      deletedCount
    });
  } catch (error) {
    console.error('Bulk delete users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk delete users'
    });
  }
});

router.post('/admin/bulk/import-users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { users, format = 'json' } = req.body;

    if (!users) {
      return res.status(400).json({
        success: false,
        error: 'users data is required'
      });
    }

    let parsedUsers = [];

    if (format === 'csv') {
      const parsed = papaparse.parse(users, { header: true });
      parsedUsers = parsed.data;
    } else {
      parsedUsers = Array.isArray(users) ? users : JSON.parse(users);
    }

    if (!Array.isArray(parsedUsers) || parsedUsers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid users to import'
      });
    }

    const bcrypt = await import('bcryptjs');
    const createdUsers = [];
    const errors = [];

    for (const userData of parsedUsers) {
      try {
        if (!userData.email || !userData.password) {
          errors.push({ email: userData.email, error: 'Email and password required' });
          continue;
        }

        const existingUser = await User.findOne({ where: { email: userData.email } });
        if (existingUser) {
          errors.push({ email: userData.email, error: 'User already exists' });
          continue;
        }

        const hashedPassword = await bcrypt.hash(userData.password, 12);
        const newUser = await User.create({
          email: userData.email,
          password: hashedPassword,
          role: userData.role || 'user',
          vipExpiresAt: userData.vipExpiresAt ? new Date(userData.vipExpiresAt) : null
        });

        createdUsers.push(newUser);
      } catch (err) {
        errors.push({ email: userData.email, error: err.message });
      }
    }

    await logActivity(req.user.id, 'BULK_IMPORT_USERS', 'user', null, {
      total: parsedUsers.length,
      created: createdUsers.length,
      errors: errors.length
    }, req);

    res.json({
      success: true,
      message: `${createdUsers.length} users imported successfully`,
      created: createdUsers.length,
      errors: errors.length,
      errorDetails: errors
    });
  } catch (error) {
    console.error('Bulk import users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import users'
    });
  }
});

router.post('/admin/bulk/endpoints/import', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { endpoints } = req.body;

    if (!Array.isArray(endpoints) || endpoints.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'endpoints array is required and must not be empty'
      });
    }

    const createdEndpoints = [];
    const errors = [];

    for (const endpointData of endpoints) {
      try {
        if (!endpointData.path) {
          errors.push({ path: endpointData.path, error: 'Path is required' });
          continue;
        }

        const method = endpointData.method || 'GET';
        const existingEndpoint = await ApiEndpoint.findOne({
          where: { path: endpointData.path, method }
        });

        if (existingEndpoint) {
          const updateData = {
            description: endpointData.description || existingEndpoint.description,
            name: endpointData.name || existingEndpoint.name,
            category: endpointData.category || existingEndpoint.category
          };
          if (endpointData.requiresVIP !== undefined) {
            updateData.status = endpointData.requiresVIP ? 'vip' : 'free';
          }
          await existingEndpoint.update(updateData);
          createdEndpoints.push(existingEndpoint);
        } else {
          const status = endpointData.requiresVIP !== undefined ? (endpointData.requiresVIP ? 'vip' : 'free') : 'vip';
          const newEndpoint = await ApiEndpoint.create({
            path: endpointData.path,
            method,
            description: endpointData.description || null,
            status: status,
            name: endpointData.name || null,
            category: endpointData.category || null
          });
          createdEndpoints.push(newEndpoint);
        }
      } catch (err) {
        errors.push({ path: endpointData.path, error: err.message });
      }
    }

    refreshVIPCache();

    await logActivity(req.user.id, 'BULK_IMPORT_ENDPOINTS', 'endpoint', null, {
      total: endpoints.length,
      created: createdEndpoints.length,
      errors: errors.length
    }, req);

    res.json({
      success: true,
      message: `${createdEndpoints.length} endpoints imported successfully`,
      created: createdEndpoints.length,
      errors: errors.length,
      errorDetails: errors
    });
  } catch (error) {
    console.error('Bulk import endpoints error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import endpoints'
    });
  }
});

router.get('/admin/rate-limits', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await RateLimitConfig.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / parseInt(limit)),
      rateLimits: rows
    });
  } catch (error) {
    console.error('Get rate limits error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rate limits'
    });
  }
});

router.post('/admin/rate-limits', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { targetType, targetValue, maxRequests, windowMs, enabled } = req.body;

    if (!targetType || !targetValue) {
      return res.status(400).json({
        success: false,
        error: 'targetType and targetValue are required'
      });
    }

    if (!maxRequests || !windowMs) {
      return res.status(400).json({
        success: false,
        error: 'maxRequests and windowMs are required'
      });
    }

    const rateLimit = await RateLimitConfig.create({
      targetType,
      targetValue,
      maxRequests,
      windowMs,
      enabled: enabled !== undefined ? enabled : true
    });

    refreshRateLimitCache();

    await logActivity(req.user.id, 'CREATE_RATE_LIMIT', 'rateLimit', rateLimit.id, {
      targetType,
      targetValue,
      maxRequests,
      windowMs
    }, req);

    res.status(201).json({
      success: true,
      message: 'Rate limit created successfully',
      rateLimit
    });
  } catch (error) {
    console.error('Create rate limit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create rate limit'
    });
  }
});

router.put('/admin/rate-limits/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { targetType, targetValue, maxRequests, windowMs, enabled } = req.body;

    const rateLimit = await RateLimitConfig.findByPk(id);

    if (!rateLimit) {
      return res.status(404).json({
        success: false,
        error: 'Rate limit not found'
      });
    }

    const updates = {};
    if (targetType !== undefined) updates.targetType = targetType;
    if (targetValue !== undefined) updates.targetValue = targetValue;
    if (maxRequests !== undefined) updates.maxRequests = maxRequests;
    if (windowMs !== undefined) updates.windowMs = windowMs;
    if (enabled !== undefined) updates.enabled = enabled;

    await rateLimit.update(updates);

    refreshRateLimitCache();

    await logActivity(req.user.id, 'UPDATE_RATE_LIMIT', 'rateLimit', id, updates, req);

    res.json({
      success: true,
      message: 'Rate limit updated successfully',
      rateLimit
    });
  } catch (error) {
    console.error('Update rate limit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update rate limit'
    });
  }
});

router.delete('/admin/rate-limits/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const rateLimit = await RateLimitConfig.findByPk(id);

    if (!rateLimit) {
      return res.status(404).json({
        success: false,
        error: 'Rate limit not found'
      });
    }

    await rateLimit.destroy();

    refreshRateLimitCache();

    await logActivity(req.user.id, 'DELETE_RATE_LIMIT', 'rateLimit', id, {}, req);

    res.json({
      success: true,
      message: 'Rate limit deleted successfully'
    });
  } catch (error) {
    console.error('Delete rate limit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete rate limit'
    });
  }
});

router.get('/admin/ip-whitelist', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await IpWhitelist.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / parseInt(limit)),
      ipWhitelist: rows
    });
  } catch (error) {
    console.error('Get IP whitelist error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch IP whitelist'
    });
  }
});

router.post('/admin/ip-whitelist', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { ipAddress, description, enabled } = req.body;

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'ipAddress is required'
      });
    }

    const existingIp = await IpWhitelist.findOne({ where: { ipAddress } });

    if (existingIp) {
      return res.status(400).json({
        success: false,
        error: 'IP address already in whitelist'
      });
    }

    const whitelist = await IpWhitelist.create({
      ipAddress,
      description: description || null,
      enabled: enabled !== undefined ? enabled : true
    });

    await logActivity(req.user.id, 'ADD_IP_WHITELIST', 'ipWhitelist', whitelist.id, {
      ipAddress,
      description
    }, req);

    res.status(201).json({
      success: true,
      message: 'IP added to whitelist successfully',
      whitelist
    });
  } catch (error) {
    console.error('Add IP whitelist error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add IP to whitelist'
    });
  }
});

router.delete('/admin/ip-whitelist/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const whitelist = await IpWhitelist.findByPk(id);

    if (!whitelist) {
      return res.status(404).json({
        success: false,
        error: 'IP whitelist entry not found'
      });
    }

    await whitelist.destroy();

    await logActivity(req.user.id, 'REMOVE_IP_WHITELIST', 'ipWhitelist', id, {
      ipAddress: whitelist.ipAddress
    }, req);

    res.json({
      success: true,
      message: 'IP removed from whitelist successfully'
    });
  } catch (error) {
    console.error('Remove IP whitelist error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove IP from whitelist'
    });
  }
});

router.get('/admin/health', authenticate, authorize('admin'), async (req, res) => {
  try {
    const cpuUsage = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = {
      total: (totalMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      free: (freeMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      used: ((totalMem - freeMem) / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      percentage: (((totalMem - freeMem) / totalMem) * 100).toFixed(2) + '%'
    };

    let databaseStatus = 'unknown';
    try {
      await User.sequelize.authenticate();
      databaseStatus = 'healthy';
    } catch (dbError) {
      databaseStatus = 'unhealthy';
    }

    const endpointStats = await ApiEndpoint.count();
    const userCount = await User.count();

    const recentLogs = await ActivityLog.count({
      where: {
        createdAt: { [Op.gte]: new Date(Date.now() - 60000) }
      }
    });

    res.json({
      success: true,
      health: {
        status: databaseStatus === 'healthy' ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        system: {
          cpu: {
            load1min: cpuUsage[0],
            load5min: cpuUsage[1],
            load15min: cpuUsage[2]
          },
          memory: memoryUsage,
          uptime: os.uptime(),
          platform: os.platform(),
          hostname: os.hostname()
        },
        database: {
          status: databaseStatus,
          userCount,
          endpointCount: endpointStats
        },
        activity: {
          requestsLastMinute: recentLogs
        }
      }
    });
  } catch (error) {
    console.error('Get health error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch health metrics'
    });
  }
});

router.get('/admin/health/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    let databaseStatus = 'unknown';
    try {
      await User.sequelize.authenticate();
      databaseStatus = 'healthy';
    } catch (dbError) {
      databaseStatus = 'unhealthy';
    }

    const memUsage = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
    const systemHealthy = databaseStatus === 'healthy' && memUsage < 90;

    res.json({
      success: true,
      status: systemHealthy ? 'healthy' : 'degraded',
      database: databaseStatus,
      memoryUsage: memUsage.toFixed(2) + '%',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get health status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch health status'
    });
  }
});

router.get('/admin/notifications/config', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await NotificationConfig.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / parseInt(limit)),
      configs: rows
    });
  } catch (error) {
    console.error('Get notification configs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification configs'
    });
  }
});

router.post('/admin/notifications/config', authenticate, authorize('admin'), async (req, res) => {
  try {
    const {
      eventType,
      emailEnabled,
      emailRecipients,
      whatsappEnabled,
      whatsappRecipients,
      enabled
    } = req.body;

    if (!eventType) {
      return res.status(400).json({
        success: false,
        error: 'eventType is required'
      });
    }

    const config = await NotificationConfig.create({
      eventType,
      emailEnabled: emailEnabled || false,
      emailRecipients: emailRecipients || [],
      whatsappEnabled: whatsappEnabled || false,
      whatsappRecipients: whatsappRecipients || [],
      enabled: enabled !== undefined ? enabled : true
    });

    NotificationService.refreshCache();

    await logActivity(req.user.id, 'CREATE_NOTIFICATION_CONFIG', 'notificationConfig', config.id, {
      eventType
    }, req);

    res.status(201).json({
      success: true,
      message: 'Notification config created successfully',
      config
    });
  } catch (error) {
    console.error('Create notification config error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create notification config'
    });
  }
});

router.put('/admin/notifications/config/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      eventType,
      emailEnabled,
      emailRecipients,
      whatsappEnabled,
      whatsappRecipients,
      enabled
    } = req.body;

    const config = await NotificationConfig.findByPk(id);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Notification config not found'
      });
    }

    const updates = {};
    if (eventType !== undefined) updates.eventType = eventType;
    if (emailEnabled !== undefined) updates.emailEnabled = emailEnabled;
    if (emailRecipients !== undefined) updates.emailRecipients = emailRecipients;
    if (whatsappEnabled !== undefined) updates.whatsappEnabled = whatsappEnabled;
    if (whatsappRecipients !== undefined) updates.whatsappRecipients = whatsappRecipients;
    if (enabled !== undefined) updates.enabled = enabled;

    await config.update(updates);

    NotificationService.refreshCache();

    await logActivity(req.user.id, 'UPDATE_NOTIFICATION_CONFIG', 'notificationConfig', id, updates, req);

    res.json({
      success: true,
      message: 'Notification config updated successfully',
      config
    });
  } catch (error) {
    console.error('Update notification config error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification config'
    });
  }
});

router.delete('/admin/notifications/config/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const config = await NotificationConfig.findByPk(id);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Notification config not found'
      });
    }

    await config.destroy();

    NotificationService.refreshCache();

    await logActivity(req.user.id, 'DELETE_NOTIFICATION_CONFIG', 'notificationConfig', id, {}, req);

    res.json({
      success: true,
      message: 'Notification config deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification config error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification config'
    });
  }
});

router.post('/admin/notifications/test', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { email, phone, message } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        error: 'Email or phone number is required'
      });
    }

    const testMessage = message || 'This is a test notification from the admin panel.';

    let emailSent = false;
    let whatsappSent = false;

    if (email) {
      emailSent = await NotificationService.sendEmail(
        email,
        'Test Notification',
        `<h2>Test Notification</h2><p>${testMessage}</p>`
      );
    }

    if (phone) {
      whatsappSent = await NotificationService.sendWhatsApp([phone], testMessage);
    }

    await logActivity(req.user.id, 'TEST_NOTIFICATION', 'notification', null, {
      email,
      phone,
      emailSent,
      whatsappSent
    }, req);

    res.json({
      success: true,
      message: 'Test notification sent',
      results: {
        email: emailSent,
        whatsapp: whatsappSent
      }
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification'
    });
  }
});

export default router;
