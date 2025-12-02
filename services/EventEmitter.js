import { EventEmitter } from 'events';

class RoleChangeEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0);
  }

  notifyRoleChange(userId, oldRole, newRole, vipExpiresAt = null) {
    const changeData = {
      userId,
      oldRole,
      newRole,
      vipExpiresAt,
      timestamp: new Date().toISOString(),
      type: 'role_change'
    };

    console.log(`📢 Role Change Event: User ${userId} changed from ${oldRole} to ${newRole}`);
    
    this.emit('role-change', changeData);
    this.emit(`role-change:${userId}`, changeData);
  }

  notifyVIPGranted(userId, email, expiresAt) {
    const grantData = {
      userId,
      email,
      role: 'vip',
      vipExpiresAt: expiresAt,
      timestamp: new Date().toISOString(),
      type: 'vip_granted'
    };

    console.log(`⭐ VIP Granted Event: User ${userId} (${email}) until ${expiresAt || 'permanent'}`);
    
    this.emit('vip-granted', grantData);
    this.emit(`role-change:${userId}`, grantData);
  }

  notifyVIPRevoked(userId, email) {
    const revokeData = {
      userId,
      email,
      role: 'user',
      vipExpiresAt: null,
      timestamp: new Date().toISOString(),
      type: 'vip_revoked'
    };

    console.log(`🚫 VIP Revoked Event: User ${userId} (${email})`);
    
    this.emit('vip-revoked', revokeData);
    this.emit(`role-change:${userId}`, revokeData);
  }
}

export const roleChangeEmitter = new RoleChangeEmitter();
