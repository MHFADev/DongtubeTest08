import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * RequestLog Model - Tracks all API requests
 * @description Records detailed information about each API request for analytics and monitoring
 */
const RequestLog = sequelize.define('RequestLog', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  endpoint: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'API endpoint path'
  },
  method: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'GET',
    comment: 'HTTP method (GET, POST, etc.)'
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'user_id',
    comment: 'User ID if authenticated'
  },
  userRole: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'user_role',
    comment: 'User role at time of request'
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
    field: 'ip_address',
    comment: 'Client IP address'
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'user_agent',
    comment: 'Client user agent string'
  },
  responseTime: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'response_time',
    comment: 'Response time in milliseconds'
  },
  statusCode: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'status_code',
    comment: 'HTTP status code'
  },
  success: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether request was successful'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message',
    comment: 'Error message if request failed'
  },
  queryParams: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'query_params',
    comment: 'Query parameters (sanitized)'
  },
  requestSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'request_size',
    comment: 'Request body size in bytes'
  },
  responseSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'response_size',
    comment: 'Response body size in bytes'
  },
  cached: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether response was served from cache'
  },
  sampled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether this was a sampled request (for high-traffic endpoints)'
  }
}, {
  tableName: 'request_logs',
  timestamps: true,
  updatedAt: false,
  indexes: [
    {
      fields: ['endpoint']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['success']
    },
    {
      fields: ['endpoint', 'createdAt']
    },
    {
      fields: ['user_id', 'createdAt']
    },
    {
      fields: ['status_code']
    }
  ]
});

export default RequestLog;
