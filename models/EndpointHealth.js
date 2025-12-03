import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * EndpointHealth Model - Health status tracking
 * @description Monitors and tracks health status of API endpoints
 */
let EndpointHealth = null;

if (sequelize) {
  EndpointHealth = sequelize.define('EndpointHealth', {
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
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'healthy',
    validate: {
      isIn: [['healthy', 'degraded', 'critical', 'offline', 'disabled']]
    },
    comment: 'Current health status'
  },
  lastCheck: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_check',
    comment: 'Timestamp of last health check'
  },
  lastSuccess: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_success',
    comment: 'Timestamp of last successful check'
  },
  lastFailure: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_failure',
    comment: 'Timestamp of last failed check'
  },
  consecutiveFailures: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'consecutive_failures',
    comment: 'Number of consecutive health check failures'
  },
  consecutiveSuccesses: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'consecutive_successes',
    comment: 'Number of consecutive successful checks'
  },
  totalChecks: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'total_checks',
    comment: 'Total number of health checks performed'
  },
  totalFailures: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'total_failures',
    comment: 'Total number of failures'
  },
  uptimePercentage: {
    type: DataTypes.FLOAT,
    allowNull: true,
    field: 'uptime_percentage',
    comment: 'Uptime percentage (0-100)'
  },
  lastError: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'last_error',
    comment: 'Last error message'
  },
  lastErrorCode: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'last_error_code',
    comment: 'Last HTTP error code'
  },
  lastResponseTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'last_response_time',
    comment: 'Last check response time in ms'
  },
  avgResponseTime: {
    type: DataTypes.FLOAT,
    allowNull: true,
    field: 'avg_response_time',
    comment: 'Average response time in ms'
  },
  autoDisabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'auto_disabled',
    comment: 'Whether endpoint was auto-disabled due to failures'
  },
  disabledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'disabled_at',
    comment: 'When endpoint was auto-disabled'
  },
  monitoringEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'monitoring_enabled',
    comment: 'Whether health monitoring is enabled for this endpoint'
  },
  checkInterval: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 300000,
    field: 'check_interval',
    comment: 'Health check interval in milliseconds'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional metadata and configuration'
  }
}, {
  tableName: 'endpoint_health',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['endpoint', 'method']
    },
    {
      fields: ['status']
    },
    {
      fields: ['auto_disabled']
    },
    {
      fields: ['monitoring_enabled']
    },
    {
      fields: ['last_check']
    },
    {
      fields: ['uptime_percentage']
    }
  ]
});
} else {
  console.warn('⚠️ EndpointHealth model not initialized: Database connection unavailable');
}

export default EndpointHealth;
