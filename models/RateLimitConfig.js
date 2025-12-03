import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

let RateLimitConfig = null;

if (sequelize) {
  RateLimitConfig = sequelize.define('RateLimitConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  targetType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'target_type',
    comment: 'role, endpoint, ip, user'
  },
  targetValue: {
    type: DataTypes.STRING(200),
    allowNull: false,
    field: 'target_value',
    comment: 'user, vip, admin, /api/endpoint, 192.168.1.1, userId'
  },
  maxRequests: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100,
    field: 'max_requests'
  },
  windowMs: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3600000,
    field: 'window_ms',
    comment: 'Time window in milliseconds'
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'rate_limit_configs',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['target_type', 'target_value']
    }
  ]
});
} else {
  console.warn('⚠️ RateLimitConfig model not initialized: Database connection unavailable');
}

export default RateLimitConfig;
