import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

let User = null;

if (sequelize) {
  User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING(60),
      allowNull: false
    },
    role: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'user',
      validate: {
        isIn: [['user', 'vip', 'admin']]
      }
    },
    vipExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'vip_expires_at'
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login'
    }
  }, {
    tableName: 'users',
    timestamps: true,
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ['email']
      }
    ]
  });
} else {
  console.warn('⚠️ User model not initialized: Database connection unavailable');
}

export default User;
