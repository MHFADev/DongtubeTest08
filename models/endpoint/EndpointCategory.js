import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

let EndpointCategory = null;

if (sequelize) {
  EndpointCategory = sequelize.define('EndpointCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Category name (e.g., social-media, tools, ai)'
  },
  displayName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'display_name',
    comment: 'Human-readable category name'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Category description'
  },
  icon: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Icon class or emoji for the category'
  },
  color: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Hex color code for UI theming'
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Display order (higher = shows first)'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
    comment: 'Whether this category is active'
  }
}, {
  tableName: 'endpoint_categories',
  timestamps: true,
  indexes: [
    {
      fields: ['priority']
    }
  ]
});
} else {
  console.warn('⚠️ EndpointCategory model not initialized: Database connection unavailable');
}

export default EndpointCategory;
