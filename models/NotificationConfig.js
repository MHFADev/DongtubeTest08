import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

let NotificationConfig = null;

if (sequelize) {
  NotificationConfig = sequelize.define('NotificationConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  eventType: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'event_type'
  },
  emailEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'email_enabled'
  },
  whatsappEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'whatsapp_enabled'
  },
  emailRecipients: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'email_recipients',
    comment: 'Array of email addresses'
  },
  whatsappRecipients: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'whatsapp_recipients',
    comment: 'Array of phone numbers'
  },
  threshold: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'For events like error_alert, trigger after X occurrences'
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'notification_configs',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['event_type']
    }
  ]
});
} else {
  console.warn('⚠️ NotificationConfig model not initialized: Database connection unavailable');
}

export default NotificationConfig;
