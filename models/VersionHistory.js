import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

let VersionHistory = null;

if (sequelize) {
  VersionHistory = sequelize.define('VersionHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  version: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  changedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'changed_by'
  },
  changeLog: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'change_log'
  }
}, {
  tableName: 'version_history',
  timestamps: true,
  updatedAt: false
});
} else {
  console.warn('⚠️ VersionHistory model not initialized: Database connection unavailable');
}

export default VersionHistory;
