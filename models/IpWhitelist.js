import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const IpWhitelist = sequelize.define('IpWhitelist', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: false,
    field: 'ip_address'
  },
  description: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'ip_whitelists',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['ip_address']
    }
  ]
});

export default IpWhitelist;
