import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

let ApiEndpoint = null;

if (sequelize) {
  ApiEndpoint = sequelize.define('ApiEndpoint', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  path: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: 'API endpoint path (e.g., /api/tiktok/download)'
  },
  method: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'GET',
    comment: 'HTTP method (GET, POST, PUT, DELETE, or comma-separated for multiple)'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Display name for the endpoint'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Detailed description of what the endpoint does'
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Category for grouping (e.g., social-media, tools, ai)'
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'free',
    allowNull: false,
    comment: 'Access level: free (public), vip (requires VIP), premium (requires payment), disabled (not accessible)'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
    comment: 'Whether the endpoint is currently active/available'
  },
  parameters: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'JSON array of parameter definitions with name, type, required, etc.'
  },
  examples: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'JSON array of example requests and responses'
  },
  rateLimit: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'rate_limit',
    comment: 'Max requests per hour (null = no limit)'
  },
  rateLimitWindow: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 3600000,
    field: 'rate_limit_window',
    comment: 'Rate limit window in milliseconds (default: 1 hour)'
  },
  customHeaders: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'custom_headers',
    comment: 'Custom headers required for this endpoint'
  },
  responseType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'json',
    field: 'response_type',
    comment: 'Response type: json, binary, text, stream, etc.'
  },
  responseBinary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'response_binary',
    comment: 'Whether response is binary data'
  },
  sourceFile: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'source_file',
    comment: 'Original route file name (e.g., route-tiktok.js)'
  },
  lastSyncedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_synced_at',
    comment: 'Last time this endpoint was synced from route files'
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Display priority (higher = shows first)'
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Tags for searching/filtering (array of strings)'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional metadata (e.g., version, author, changelog)'
  }
}, {
  tableName: 'api_endpoints',
  timestamps: true,
  indexes: [
    {
      fields: ['status']
    },
    {
      fields: ['category']
    },
    {
      fields: ['is_active']
    }
  ]
});
} else {
  console.warn('⚠️ ApiEndpoint model not initialized: Database connection unavailable');
}

export default ApiEndpoint;
