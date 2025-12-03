import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * PerformanceMetric Model - Aggregated performance metrics
 * @description Stores pre-aggregated performance statistics for fast querying
 */
let PerformanceMetric = null;

if (sequelize) {
  PerformanceMetric = sequelize.define('PerformanceMetric', {
  id: {
    type: DataTypes.INTEGER,
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
    comment: 'HTTP method'
  },
  timeWindow: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'time_window',
    comment: 'Time window: 1min, 5min, 1hour, 1day'
  },
  requestCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'request_count',
    comment: 'Total number of requests'
  },
  successCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'success_count',
    comment: 'Number of successful requests'
  },
  errorCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'error_count',
    comment: 'Number of failed requests'
  },
  errorRate: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
    field: 'error_rate',
    comment: 'Error rate percentage (0-100)'
  },
  avgResponseTime: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
    field: 'avg_response_time',
    comment: 'Average response time in ms'
  },
  minResponseTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'min_response_time',
    comment: 'Minimum response time in ms'
  },
  maxResponseTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'max_response_time',
    comment: 'Maximum response time in ms'
  },
  p50ResponseTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'p50_response_time',
    comment: 'P50 (median) response time in ms'
  },
  p95ResponseTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'p95_response_time',
    comment: 'P95 response time in ms'
  },
  p99ResponseTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'p99_response_time',
    comment: 'P99 response time in ms'
  },
  uniqueUsers: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'unique_users',
    comment: 'Number of unique users'
  },
  uniqueIPs: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'unique_ips',
    comment: 'Number of unique IP addresses'
  },
  totalRequestSize: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'total_request_size',
    comment: 'Total request data size in bytes'
  },
  totalResponseSize: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'total_response_size',
    comment: 'Total response data size in bytes'
  },
  cacheHitRate: {
    type: DataTypes.FLOAT,
    allowNull: true,
    field: 'cache_hit_rate',
    comment: 'Cache hit rate percentage (0-100)'
  },
  windowStart: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'window_start',
    comment: 'Start time of this metric window'
  },
  windowEnd: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'window_end',
    comment: 'End time of this metric window'
  }
}, {
  tableName: 'performance_metrics',
  timestamps: true,
  updatedAt: false,
  indexes: [
    {
      fields: ['endpoint']
    },
    {
      fields: ['time_window']
    },
    {
      fields: ['window_start']
    },
    {
      fields: ['createdAt']
    },
    {
      unique: true,
      fields: ['endpoint', 'method', 'time_window', 'window_start']
    },
    {
      fields: ['error_rate']
    },
    {
      fields: ['avg_response_time']
    }
  ]
});
} else {
  console.warn('⚠️ PerformanceMetric model not initialized: Database connection unavailable');
}

export default PerformanceMetric;
