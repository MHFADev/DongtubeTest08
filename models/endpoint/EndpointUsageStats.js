import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

let EndpointUsageStats = null;

if (sequelize) {
  EndpointUsageStats = sequelize.define('EndpointUsageStats', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  endpointId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'endpoint_id',
    comment: 'Reference to ApiEndpoint.id'
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Date of the statistics'
  },
  totalRequests: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_requests',
    comment: 'Total requests made to this endpoint'
  },
  successfulRequests: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'successful_requests',
    comment: 'Successful requests (2xx responses)'
  },
  failedRequests: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'failed_requests',
    comment: 'Failed requests (4xx, 5xx responses)'
  },
  averageResponseTime: {
    type: DataTypes.FLOAT,
    allowNull: true,
    field: 'average_response_time',
    comment: 'Average response time in milliseconds'
  },
  uniqueUsers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'unique_users',
    comment: 'Number of unique users/IPs'
  },
  uniqueIPs: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'unique_ips',
    comment: 'Array of unique IP addresses (limited to 100)'
  },
  errorTypes: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'error_types',
    comment: 'JSON object with error types and their counts'
  }
}, {
  tableName: 'endpoint_usage_stats',
  timestamps: true,
  updatedAt: false,
  indexes: [
    {
      fields: ['date']
    },
    {
      fields: ['endpoint_id']
    }
  ]
});
} else {
  console.warn('⚠️ EndpointUsageStats model not initialized: Database connection unavailable');
}

export default EndpointUsageStats;
