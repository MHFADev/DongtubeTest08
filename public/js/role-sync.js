/**
 * Real-Time Role Synchronization System
 * Automatically updates user access when admin changes role
 */

class RoleSync {
  constructor() {
    this.eventSource = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.sseSupported = true;
    this.isServerless = false;
  }

  async checkSSESupport() {
    try {
      const response = await fetch('/api/sse/status');
      const data = await response.json();
      
      this.sseSupported = data.sse_supported === true;
      this.isServerless = data.serverless === true;
      
      return this.sseSupported;
    } catch (error) {
      console.warn('⚠️ Could not check SSE status:', error.message);
      this.sseSupported = false;
      this.isServerless = true;
      return false;
    }
  }

  async connect() {
    if (this.isConnected) {
      console.log('📡 Already connected to role update stream');
      return;
    }

    if (!this.isAuthenticated()) {
      console.log('🔒 Skipping SSE connection - User not authenticated');
      return;
    }

    // Check if SSE is supported
    const sseSupported = await this.checkSSESupport();
    
    if (!sseSupported) {
      console.log('📊 SSE not supported in serverless environment');
      console.log('ℹ️  Role changes will be applied on next login or page refresh');
      return;
    }

    try {
      console.log('🔌 Connecting to real-time role update stream...');
      console.log('ℹ️  Note: Browser will automatically send httpOnly cookie with SSE request');
      
      this.eventSource = new EventSource('/sse/role-updates');

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('✅ Connected to role update stream - Changes will be applied instantly!');
      };

      this.eventSource.addEventListener('role-change', async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📢 Role change detected:', data);
          
          await this.handleRoleChange(data);
        } catch (error) {
          console.error('❌ Error handling role change event:', error);
        }
      });

      this.eventSource.onerror = (error) => {
        console.error('❌ SSE connection error:', error);
        this.isConnected = false;
        
        if (this.eventSource.readyState === EventSource.CLOSED) {
          console.log('🔌 SSE connection closed, checking if authenticated...');
          
          if (error.target && error.target.status === 401) {
            console.log('🔒 Not authenticated - SSE requires login');
          } else {
            this.reconnect();
          }
        }
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected') {
            console.log('✨ ' + data.message);
          }
        } catch (error) {
          // Heartbeat or other non-JSON messages
        }
      };

    } catch (error) {
      console.error('❌ Failed to connect to SSE:', error);
      this.reconnect();
    }
  }

  async handleRoleChange(data) {
    console.log('🔄 Processing role change:', data);
    console.log('📋 Change details:', {
      type: data.type,
      newRole: data.newRole,
      vipExpiresAt: data.vipExpiresAt,
      timestamp: data.timestamp
    });
    
    const oldRole = this.getCurrentRole();
    const newRole = data.newRole;

    if (data.requiresTokenRefresh) {
      console.log('🎫 Refreshing authentication token to apply changes...');
      
      const refreshed = await this.refreshToken();
      
      if (refreshed) {
        console.log(`✅ Token refreshed! Role updated: ${oldRole || 'unknown'} → ${newRole}`);
        
        this.invalidateAllCaches();
        
        this.showNotification(data);
        
        console.log('⏳ Reloading page in 2 seconds to apply all changes...');
        setTimeout(() => {
          console.log('🔄 Reloading now...');
          window.location.reload(true);
        }, 2000);
      } else {
        console.warn('⚠️ Token refresh failed, please login again');
        this.showLoginPrompt();
      }
    }
  }

  async refreshToken() {
    try {
      const response = await fetch('/auth/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Token refreshed successfully:', result);
        
        if (result.token) {
          localStorage.setItem('authToken', result.token);
        }
        
        return true;
      } else {
        console.error('❌ Token refresh failed:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      return false;
    }
  }

  isAuthenticated() {
    try {
      const token = localStorage.getItem('authToken');
      const currentUser = localStorage.getItem('currentUser');
      return !!(token && currentUser);
    } catch (error) {
      return false;
    }
  }

  getCurrentRole() {
    try {
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        return user.role;
      }
    } catch (error) {
      // Silent fail
    }
    return null;
  }

  invalidateAllCaches() {
    console.log('🗑️ Invalidating all frontend caches...');
    
    if (window.endpointLoader) {
      window.endpointLoader.cache = null;
      window.endpointLoader.cacheTimestamp = 0;
      console.log('✓ Endpoint loader cache cleared');
    }
    
    localStorage.removeItem('currentUser');
    console.log('✓ LocalStorage user cache cleared');
    
    console.log('✅ All caches invalidated - fresh data will be loaded');
  }

  showNotification(data) {
    const type = data.type;
    let message = '';
    let icon = '';

    switch(type) {
      case 'vip_granted':
        message = '⭐ Selamat! Akun Anda telah di-upgrade ke VIP!';
        icon = '🎉';
        break;
      case 'vip_revoked':
        message = '🔒 Akses VIP Anda telah dicabut';
        icon = '⚠️';
        break;
      case 'role_change':
        message = `🔄 Role akun diubah menjadi: ${data.newRole}`;
        icon = '✨';
        break;
      default:
        message = '🔄 Status akun Anda telah diperbarui';
        icon = 'ℹ️';
    }

    if (typeof window.showToast === 'function') {
      window.showToast(message, type === 'vip_granted' ? 'success' : 'info');
    } else if (window.Notification && Notification.permission === 'granted') {
      new Notification(icon + ' Role Update', {
        body: message,
        icon: '/favicon.ico'
      });
    } else {
      alert(message);
    }

    console.log(`${icon} ${message}`);
  }

  showLoginPrompt() {
    if (confirm('Session Anda telah berakhir. Silakan login kembali untuk melanjutkan.')) {
      window.location.href = '/login.html';
    }
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('⚠️ Max reconnection attempts reached, stopping...');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Reconnecting to SSE (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.isConnected = false;
      console.log('🔌 Disconnected from role update stream');
    }
  }

  requestNotificationPermission() {
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('✅ Notification permission granted');
        }
      });
    }
  }
}

const roleSync = new RoleSync();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    roleSync.requestNotificationPermission();
    roleSync.connect();
  });
} else {
  roleSync.requestNotificationPermission();
  roleSync.connect();
}

window.addEventListener('beforeunload', () => {
  roleSync.disconnect();
});

window.roleSync = roleSync;

console.log('🚀 Real-Time Role Sync System loaded and ready!');
