import sequelize from '../config/database.js';
import User from './User.js';
import VersionHistory from './VersionHistory.js';
import ActivityLog from './ActivityLog.js';
import RateLimitConfig from './RateLimitConfig.js';
import NotificationConfig from './NotificationConfig.js';
import IpWhitelist from './IpWhitelist.js';
import RequestLog from './RequestLog.js';
import PerformanceMetric from './PerformanceMetric.js';
import AnomalyAlert from './AnomalyAlert.js';
import EndpointHealth from './EndpointHealth.js';
import { ApiEndpoint, EndpointCategory, EndpointUsageStats, initEndpointDatabase } from './endpoint/index.js';
import crypto from 'crypto';

const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected');
    
    console.log('📊 Syncing database tables...');
    await User.sync();
    console.log('  ✓ User table synced');
    await VersionHistory.sync();
    console.log('  ✓ VersionHistory table synced');
    await ActivityLog.sync();
    console.log('  ✓ ActivityLog table synced');
    await RateLimitConfig.sync();
    console.log('  ✓ RateLimitConfig table synced');
    await NotificationConfig.sync();
    console.log('  ✓ NotificationConfig table synced');
    await IpWhitelist.sync();
    console.log('  ✓ IpWhitelist table synced');
    
    await RequestLog.sync();
    console.log('  ✓ RequestLog table synced');
    await PerformanceMetric.sync();
    console.log('  ✓ PerformanceMetric table synced');
    await AnomalyAlert.sync();
    console.log('  ✓ AnomalyAlert table synced');
    await EndpointHealth.sync();
    console.log('  ✓ EndpointHealth table synced');
    
    // Note: Endpoint tables (ApiEndpoint, EndpointCategory, EndpointUsageStats) 
    // are synced separately via initEndpointDatabase() in server.js
    console.log('✓ All database tables synced (including analytics tables)');
    
    const adminExists = await User.findOne({ where: { role: 'admin' } });
    if (!adminExists) {
      const bcrypt = await import('bcryptjs');
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 12);
      await User.create({
        email: 'admin@dongtube.com',
        password: hashedPassword,
        role: 'admin'
      });
      console.log('\n' + '='.repeat(70));
      console.log('✓ ADMIN ACCOUNT CREATED');
      console.log('='.repeat(70));
      console.log('  Email:    admin@dongtube.com');
      console.log('  Password: ' + randomPassword);
      console.log('='.repeat(70));
      console.log('⚠️  IMPORTANT: Save this password now! It will not be shown again.');
      console.log('='.repeat(70) + '\n');
    }
    
    return true;
  } catch (error) {
    console.error('✗ Database error:', error.message);
    return false;
  }
};

export { 
  sequelize, 
  User, 
  VersionHistory,
  ActivityLog,
  RateLimitConfig,
  NotificationConfig,
  IpWhitelist,
  RequestLog,
  PerformanceMetric,
  AnomalyAlert,
  EndpointHealth,
  ApiEndpoint,
  EndpointCategory,
  EndpointUsageStats,
  initDatabase 
};
