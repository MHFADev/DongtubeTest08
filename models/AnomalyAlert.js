import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * AnomalyAlert Model - Detected anomalies and alerts
 * @description Stores anomaly detection results and alerts for monitoring
 */
let AnomalyAlert = null;

if (sequelize) {
  AnomalyAlert = sequelize.define('AnomalyAlert', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Anomaly type: error_spike, latency_spike, traffic_spike, etc.'
  },
  severity: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'medium',
    validate: {
      isIn: [['low', 'medium', 'high', 'critical']]
    },
    comment: 'Severity level of the anomaly'
  },
  endpoint: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Affected endpoint (null for system-wide anomalies)'
  },
  method: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'HTTP method if endpoint-specific'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Human-readable description of the anomaly'
  },
  detectionMethod: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'detection_method',
    comment: 'Detection method: zscore, iqr, threshold, pattern'
  },
  currentValue: {
    type: DataTypes.FLOAT,
    allowNull: true,
    field: 'current_value',
    comment: 'Current metric value that triggered the alert'
  },
  expectedValue: {
    type: DataTypes.FLOAT,
    allowNull: true,
    field: 'expected_value',
    comment: 'Expected/baseline value'
  },
  deviation: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Deviation from expected (in standard deviations or percentage)'
  },
  confidence: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Confidence score (0-100)'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional context and data'
  },
  acknowledged: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether admin has acknowledged this alert'
  },
  acknowledgedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'acknowledged_by',
    comment: 'Admin user ID who acknowledged'
  },
  acknowledgedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'acknowledged_at',
    comment: 'When the alert was acknowledged'
  },
  resolved: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether the anomaly has been resolved'
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'resolved_at',
    comment: 'When the anomaly was resolved'
  },
  notificationSent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'notification_sent',
    comment: 'Whether notification was sent'
  }
}, {
  tableName: 'anomaly_alerts',
  timestamps: true,
  updatedAt: true,
  indexes: [
    {
      fields: ['type']
    },
    {
      fields: ['severity']
    },
    {
      fields: ['endpoint']
    },
    {
      fields: ['acknowledged']
    },
    {
      fields: ['resolved']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['type', 'endpoint', 'createdAt']
    }
  ]
});
} else {
  console.warn('⚠️ AnomalyAlert model not initialized: Database connection unavailable');
}

export default AnomalyAlert;
