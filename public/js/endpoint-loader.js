/**
 * Dynamic Endpoint Loader with Advanced Real-time Synchronization
 * Features:
 * - SSE with smart reconnection
 * - Polling fallback
 * - Optimistic updates
 * - Cross-tab sync via BroadcastChannel
 * - Granular DOM updates
 * - Version tracking
 * - Status reconciliation
 */

class EndpointLoader {
  constructor() {
    this.endpoints = [];
    this.categories = [];
    this.loading = false;
    this.cache = null;
    this.cacheTimestamp = 0;
    this.CACHE_DURATION = 0; // No cache for real-time updates
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.containerSelector = null;
    
    // Advanced sync features
    this.version = 0; // Track data version (client-side counter)
    this.serverVersion = 0; // Track server-reported version for polling comparison
    this.pendingUpdates = new Map(); // Optimistic updates
    this.updateHistory = []; // Track update history
    this.lastSSEActivity = Date.now();
    this.sseHealthCheckInterval = null;
    this.pollingInterval = null;
    this.pollingEnabled = false;
    this.pollingFrequency = 10000; // 10 seconds
    this.broadcastChannel = null;
    this.connectionStatus = 'disconnected'; // disconnected, connecting, connected, degraded
    this.statusIndicator = null;
    
    // Serverless detection
    this.sseSupported = true; // Will be checked on init
    this.isServerless = false;
    
    // Initialize cross-tab sync
    this.initCrossTabSync();
    
    // Initialize connection health monitoring
    this.initHealthMonitoring();
  }

  /**
   * Initialize cross-tab synchronization
   */
  initCrossTabSync() {
    if ('BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('endpoint-sync');
      
      this.broadcastChannel.onmessage = (event) => {
        const { type, data } = event.data;
        
        console.log('📡 Cross-tab message received:', type, data);
        
        switch (type) {
          case 'endpoint_updated':
            this.handleCrossTabUpdate(data);
            break;
          case 'status_changed':
            this.handleCrossTabStatusChange(data);
            break;
          case 'full_reload':
            this.handleCrossTabFullReload();
            break;
        }
      };
      
      console.log('✓ Cross-tab sync initialized');
    }
  }

  /**
   * Broadcast update to other tabs
   */
  broadcastToOtherTabs(type, data) {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type, data });
      console.log('📤 Broadcasted to other tabs:', type);
    }
  }

  /**
   * Handle cross-tab endpoint update
   */
  async handleCrossTabUpdate(endpointData) {
    console.log('🔄 Processing cross-tab update:', endpointData);
    
    // Update in local cache
    const index = this.endpoints.findIndex(ep => ep.id === endpointData.id);
    if (index !== -1) {
      this.endpoints[index] = endpointData;
      this.updateEndpointInDOM(endpointData);
      this.showNotification('Updated from another tab', 'info');
    } else {
      // New endpoint, reload all
      await this.loadEndpoints(true);
      this.renderEndpoints();
    }
  }

  /**
   * Handle cross-tab status change
   */
  handleCrossTabStatusChange(data) {
    const { endpointId, status } = data;
    console.log(`🔄 Cross-tab status change: ${endpointId} -> ${status}`);
    
    const index = this.endpoints.findIndex(ep => ep.id === endpointId);
    if (index !== -1) {
      this.endpoints[index].status = status;
      this.updateEndpointStatusInDOM(endpointId, status);
    }
  }

  /**
   * Handle cross-tab full reload
   */
  async handleCrossTabFullReload() {
    console.log('🔄 Cross-tab triggered full reload');
    await this.loadEndpoints(true);
    this.renderEndpoints();
  }

  /**
   * Initialize connection health monitoring
   */
  initHealthMonitoring() {
    // Check SSE health every 45 seconds
    this.sseHealthCheckInterval = setInterval(() => {
      this.checkSSEHealth();
    }, 45000);
  }

  /**
   * Check SSE connection health
   */
  checkSSEHealth() {
    const timeSinceLastActivity = Date.now() - this.lastSSEActivity;
    
    // If no activity for 90 seconds, connection might be dead
    if (timeSinceLastActivity > 90000 && this.eventSource) {
      console.warn('⚠️ SSE appears inactive, reconnecting...');
      this.updateConnectionStatus('degraded');
      this.disconnectRealtimeUpdates();
      this.connectRealtimeUpdates();
    }
    
    // Enable polling as fallback if SSE is unreliable
    if (timeSinceLastActivity > 120000 && !this.pollingEnabled) {
      console.warn('⚠️ SSE unreliable, enabling polling fallback');
      this.enablePolling();
    }
  }

  /**
   * Enable polling as fallback
   */
  async enablePolling() {
    if (this.pollingEnabled) return;
    
    console.log('📊 Enabling polling fallback');
    this.pollingEnabled = true;
    
    // Initialize server version before starting polling
    await this.fetchServerVersion();
    
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollForUpdates();
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, this.pollingFrequency);
  }

  /**
   * Disable polling
   */
  disablePolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.pollingEnabled = false;
      console.log('📊 Polling disabled');
    }
  }

  /**
   * Poll for updates
   */
  async pollForUpdates() {
    try {
      const response = await fetch('/api/endpoints/version');
      const data = await response.json();
      
      // Compare against server-reported version, not client counter
      if (data.success && data.version > this.serverVersion) {
        console.log(`🔄 Polling detected update: v${this.serverVersion} -> v${data.version}`);
        this.serverVersion = data.version;
        await this.loadEndpoints(true);
        this.renderEndpoints();
        this.showNotification('Updates detected (polling)', 'info');
      }
    } catch (error) {
      console.error('Poll error:', error);
    }
  }

  /**
   * Fetch and store server version
   */
  async fetchServerVersion() {
    try {
      const response = await fetch('/api/endpoints/version');
      const data = await response.json();
      
      if (data.success && data.version) {
        this.serverVersion = data.version;
        console.log(`📊 Server version initialized: ${this.serverVersion}`);
      }
    } catch (error) {
      console.warn('Could not fetch server version:', error.message);
    }
  }

  /**
   * Update connection status
   */
  updateConnectionStatus(status) {
    this.connectionStatus = status;
    this.updateStatusIndicator();
    console.log(`📡 Connection status: ${status}`);
  }

  /**
   * Update status indicator in UI
   */
  updateStatusIndicator() {
    if (!this.statusIndicator) {
      this.createStatusIndicator();
    }
    
    const indicator = this.statusIndicator;
    const statusMap = {
      connected: { color: '#4caf50', text: '● Live', title: 'Real-time updates active' },
      connecting: { color: '#ff9800', text: '◐ Connecting', title: 'Connecting to server...' },
      degraded: { color: '#ff9800', text: '◑ Degraded', title: 'Connection issues, using fallback' },
      disconnected: { color: '#f44336', text: '○ Offline', title: 'Disconnected, updates may be delayed' }
    };
    
    const config = statusMap[this.connectionStatus] || statusMap.disconnected;
    indicator.style.color = config.color;
    indicator.textContent = config.text;
    indicator.title = config.title;
  }

  /**
   * Create status indicator element
   */
  createStatusIndicator() {
    this.statusIndicator = document.createElement('div');
    this.statusIndicator.id = 'endpoint-status-indicator';
    this.statusIndicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      z-index: 9999;
      backdrop-filter: blur(10px);
      cursor: pointer;
      transition: all 0.3s ease;
    `;
    
    this.statusIndicator.addEventListener('click', () => {
      this.showConnectionInfo();
    });
    
    document.body.appendChild(this.statusIndicator);
  }

  /**
   * Show connection info dialog
   */
  showConnectionInfo() {
    const info = `
Connection Status: ${this.connectionStatus}
SSE Connected: ${this.eventSource ? 'Yes' : 'No'}
Polling Enabled: ${this.pollingEnabled ? 'Yes' : 'No'}
Last Activity: ${new Date(this.lastSSEActivity).toLocaleTimeString()}
Version: ${this.version}
Endpoints Cached: ${this.endpoints.length}
    `.trim();
    
    alert(info);
  }

  /**
   * Load all endpoints from database
   */
  async loadEndpoints(forceRefresh = false) {
    // Check cache
    const currentTime = Date.now();
    if (!forceRefresh && this.cache && (currentTime - this.cacheTimestamp) < this.CACHE_DURATION) {
      console.log('📦 Using cached endpoints');
      return this.cache;
    }

    if (this.loading) {
      console.log('⏳ Already loading endpoints...');
      return this.cache;
    }

    this.loading = true;

    try {
      console.log('🔄 Loading endpoints from database...');

      // First, try to load from database via /api/docs
      const response = await fetch('/api/docs');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load endpoints');
      }

      this.endpoints = data.endpoints;
      this.cache = data;
      this.cacheTimestamp = currentTime;
      
      this.version++;

      const source = data.fallback ? 'route files (fallback)' : 'database';
      console.log(`✓ Loaded ${this.endpoints.length} endpoints from ${source} (v${this.version})`);
      if (data.fallback) {
        console.log(`⚠️ ${data.note}`);
      }

      this.loading = false;
      return data;
    } catch (error) {
      console.error('✗ Failed to load endpoints:', error);
      this.loading = false;
      throw error;
    }
  }

  /**
   * Load categories from database
   */
  async loadCategories() {
    try {
      const response = await fetch('/api/endpoints/categories');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load categories');
      }

      this.categories = data.categories;
      console.log(`✓ Loaded ${this.categories.length} categories`);

      return data.categories;
    } catch (error) {
      console.error('✗ Failed to load categories:', error);
      throw error;
    }
  }

  /**
   * Get endpoints by category
   */
  getEndpointsByCategory(category) {
    return this.endpoints.filter(ep => ep.category === category);
  }

  /**
   * Get endpoints by status
   */
  getEndpointsByStatus(status) {
    return this.endpoints.filter(ep => ep.status === status);
  }

  /**
   * Search endpoints
   */
  searchEndpoints(query) {
    const lowerQuery = query.toLowerCase();
    return this.endpoints.filter(ep => 
      ep.name.toLowerCase().includes(lowerQuery) ||
      ep.path.toLowerCase().includes(lowerQuery) ||
      (ep.description && ep.description.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get endpoint statistics
   */
  async getStats() {
    try {
      const response = await fetch('/api/endpoints/from-routes/stats');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load stats');
      }

      return data.stats;
    } catch (error) {
      console.error('✗ Failed to load stats:', error);
      throw error;
    }
  }

  /**
   * Render endpoints to DOM
   */
  renderEndpoints(containerSelector) {
    // Store container selector for future re-renders
    if (containerSelector) {
      this.containerSelector = containerSelector;
    }
    
    // Use stored selector if not provided
    const selector = containerSelector || this.containerSelector || '#endpointsContainer';
    
    const container = document.querySelector(selector);
    if (!container) {
      console.error('Container not found:', selector);
      return;
    }

    // Clear container
    container.innerHTML = '';

    if (this.endpoints.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 40px; color: #888;">No endpoints available</p>';
      return;
    }

    // Group by category
    const grouped = {};
    this.endpoints.forEach(ep => {
      const cat = ep.category || 'other';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(ep);
    });

    // Render each category
    Object.keys(grouped).sort().forEach(category => {
      const categorySection = this.renderCategorySection(category, grouped[category]);
      container.appendChild(categorySection);
    });

    console.log('✓ Rendered endpoints to DOM');
  }

  /**
   * Render category section
   */
  renderCategorySection(category, endpoints) {
    const section = document.createElement('div');
    section.className = 'category-section';
    section.innerHTML = `
      <h3 class="category-section-title">
        ${this.getCategoryDisplayName(category)}
        <span class="category-section-count">${endpoints.length}</span>
      </h3>
      <div class="endpoints-list"></div>
    `;

    const list = section.querySelector('.endpoints-list');

    endpoints.forEach((ep, index) => {
      const endpointEl = this.renderEndpoint(ep, index);
      list.appendChild(endpointEl);
    });

    return section;
  }

  /**
   * Render single endpoint
   */
  renderEndpoint(endpoint, index) {
    const div = document.createElement('div');
    div.className = 'endpoint';
    div.dataset.endpointId = endpoint.id;
    div.dataset.status = endpoint.status;
    div.dataset.version = this.version;

    // Status badge
    const statusBadge = this.createStatusBadge(endpoint.status, endpoint);

    div.innerHTML = `
      <div class="endpoint-header">
        <span class="endpoint-number">${index + 1}</span>
        <span class="method method-${endpoint.method.toLowerCase()}">${endpoint.method}</span>
        <span class="endpoint-path">${endpoint.path}</span>
        ${statusBadge}
        <span class="expand-icon">▼</span>
      </div>
      <div class="endpoint-body" style="display: none;">
        <p class="endpoint-desc">${endpoint.description || 'No description available'}</p>
        ${this.renderParameters(endpoint.parameters)}
        ${this.renderExamples(endpoint)}
      </div>
    `;

    // Add click handler
    const header = div.querySelector('.endpoint-header');
    header.addEventListener('click', () => {
      div.classList.toggle('active');
      const body = div.querySelector('.endpoint-body');
      const icon = div.querySelector('.expand-icon');
      if (div.classList.contains('active')) {
        body.style.display = 'block';
        icon.textContent = '▲';
      } else {
        body.style.display = 'none';
        icon.textContent = '▼';
      }
    });

    return div;
  }

  /**
   * Create status badge HTML
   */
  createStatusBadge(status, endpoint = null) {
    let badgeHTML = '';
    if (status === 'vip' || status === 'premium') {
      const icon = status === 'premium' ? '👑' : '⭐';
      const vipClass = status === 'premium' ? 'premium-badge' : 'vip-badge';
      badgeHTML = `<span class="${vipClass} status-badge vip-glow" data-status="${status}" onclick="window.endpointLoader.showVIPModal('${status}', ${endpoint ? `'${endpoint.name}'` : 'null'}, ${endpoint ? `'${endpoint.path}'` : 'null'})">${icon} ${status.toUpperCase()} <span class="vip-sparkle">✨</span></span>`;
    } else if (status === 'disabled') {
      badgeHTML = '<span class="disabled-badge status-badge" data-status="disabled">🚫 DISABLED</span>';
    } else {
      badgeHTML = '<span class="free-badge status-badge" data-status="free">✓ FREE</span>';
    }
    return badgeHTML;
  }

  /**
   * Show VIP Modal with complex design and animations
   */
  showVIPModal(status, endpointName, endpointPath) {
    const existingModal = document.getElementById('vip-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modalHTML = `
      <div id="vip-modal" class="vip-modal-overlay" onclick="if(event.target === this) this.remove();">
        <div class="vip-modal-content">
          <div class="vip-modal-header">
            <div class="vip-icon-container">
              ${status === 'premium' ? '<div class="vip-crown">👑</div>' : '<div class="vip-star">⭐</div>'}
              <div class="vip-sparkles">
                <span class="sparkle">✨</span>
                <span class="sparkle">✨</span>
                <span class="sparkle">✨</span>
              </div>
            </div>
            <h2 class="vip-modal-title">${status === 'premium' ? '🌟 Premium Feature' : '⭐ VIP Feature'}</h2>
            <p class="vip-modal-subtitle">Upgrade untuk akses unlimited!</p>
          </div>
          
          <div class="vip-modal-body">
            <div class="vip-endpoint-info">
              <h3>📍 Endpoint yang Anda coba akses:</h3>
              <div class="vip-endpoint-detail">
                <code>${endpointPath || 'Unknown'}</code>
                <p>${endpointName || 'Premium Endpoint'}</p>
              </div>
            </div>

            <div class="vip-benefits">
              <h3>🎁 Keuntungan ${status === 'premium' ? 'Premium' : 'VIP'} Member:</h3>
              <ul class="vip-benefits-list">
                <li class="benefit-item">
                  <span class="benefit-icon">⚡</span>
                  <span>Akses semua endpoint ${status.toUpperCase()}</span>
                </li>
                <li class="benefit-item">
                  <span class="benefit-icon">🚀</span>
                  <span>Rate limit lebih tinggi (unlimited requests)</span>
                </li>
                <li class="benefit-item">
                  <span class="benefit-icon">💎</span>
                  <span>Priority support & fast response</span>
                </li>
                <li class="benefit-item">
                  <span class="benefit-icon">🔥</span>
                  <span>Akses fitur terbaru & eksklusif</span>
                </li>
                <li class="benefit-item">
                  <span class="benefit-icon">🎯</span>
                  <span>API documentation lengkap</span>
                </li>
              </ul>
            </div>

            <div class="vip-cta">
              <a href="https://wa.me/6281234567890?text=${encodeURIComponent('Halo! Saya ingin upgrade ke ' + status.toUpperCase() + ' untuk akses premium API 🚀')}" 
                 target="_blank" 
                 class="vip-upgrade-btn">
                <span class="btn-icon">💬</span>
                <span>Chat Admin untuk Upgrade</span>
                <span class="btn-arrow">→</span>
              </a>
              <p class="vip-note">💡 Response cepat, proses mudah!</p>
            </div>
          </div>

          <button class="vip-modal-close" onclick="document.getElementById('vip-modal').remove();">
            <span>✕</span>
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    setTimeout(() => {
      const modal = document.getElementById('vip-modal');
      if (modal) {
        modal.classList.add('vip-modal-show');
      }
    }, 10);

    console.log(`🌟 VIP Modal shown for ${status} endpoint: ${endpointPath}`);
  }

  /**
   * Update single endpoint in DOM (granular update)
   */
  updateEndpointInDOM(endpoint) {
    const endpointEl = document.querySelector(`[data-endpoint-id="${endpoint.id}"]`);
    
    if (!endpointEl) {
      console.warn('Endpoint element not found in DOM, full re-render needed');
      this.renderEndpoints();
      return;
    }

    console.log(`🔄 Updating endpoint in DOM: ${endpoint.path}`);

    // Update status attribute
    endpointEl.dataset.status = endpoint.status;
    endpointEl.dataset.version = this.version;

    // Update status badge
    const statusBadgeContainer = endpointEl.querySelector('.endpoint-header');
    const oldBadge = statusBadgeContainer.querySelector('.status-badge');
    
    if (oldBadge) {
      const newBadge = document.createElement('span');
      newBadge.outerHTML = this.createStatusBadge(endpoint.status);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = this.createStatusBadge(endpoint.status);
      
      // Add update animation
      oldBadge.style.transition = 'all 0.3s ease';
      oldBadge.style.opacity = '0';
      oldBadge.style.transform = 'scale(0.8)';
      
      setTimeout(() => {
        oldBadge.replaceWith(tempDiv.firstChild);
        const newBadgeEl = statusBadgeContainer.querySelector('.status-badge');
        newBadgeEl.style.opacity = '0';
        newBadgeEl.style.transform = 'scale(1.2)';
        
        requestAnimationFrame(() => {
          newBadgeEl.style.transition = 'all 0.3s ease';
          newBadgeEl.style.opacity = '1';
          newBadgeEl.style.transform = 'scale(1)';
        });
      }, 300);
    }

    // Add flash effect to show update
    endpointEl.classList.add('endpoint-updated');
    setTimeout(() => {
      endpointEl.classList.remove('endpoint-updated');
    }, 1000);
  }

  /**
   * Update endpoint status in DOM (even more granular)
   */
  updateEndpointStatusInDOM(endpointId, status) {
    const endpointEl = document.querySelector(`[data-endpoint-id="${endpointId}"]`);
    
    if (!endpointEl) {
      console.warn('Endpoint element not found in DOM');
      return;
    }

    console.log(`🎨 Updating status badge: ${endpointId} -> ${status}`);

    // Update in local cache
    const endpoint = this.endpoints.find(ep => ep.id === endpointId);
    if (endpoint) {
      endpoint.status = status;
    }

    // Update DOM
    endpointEl.dataset.status = status;
    
    const statusBadgeContainer = endpointEl.querySelector('.endpoint-header');
    const oldBadge = statusBadgeContainer.querySelector('.status-badge');
    
    if (oldBadge) {
      oldBadge.style.transition = 'all 0.3s ease';
      oldBadge.style.opacity = '0';
      oldBadge.style.transform = 'scale(0.8)';
      
      setTimeout(() => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.createStatusBadge(status);
        oldBadge.replaceWith(tempDiv.firstChild);
        
        const newBadgeEl = statusBadgeContainer.querySelector('.status-badge');
        newBadgeEl.style.opacity = '0';
        newBadgeEl.style.transform = 'scale(1.2)';
        
        requestAnimationFrame(() => {
          newBadgeEl.style.transition = 'all 0.3s ease';
          newBadgeEl.style.opacity = '1';
          newBadgeEl.style.transform = 'scale(1)';
        });
      }, 300);
    }

    // Flash effect
    endpointEl.classList.add('endpoint-updated');
    setTimeout(() => {
      endpointEl.classList.remove('endpoint-updated');
    }, 1000);
  }

  /**
   * Optimistic update - update UI immediately, then confirm
   */
  async applyOptimisticUpdate(endpointId, newStatus) {
    console.log(`⚡ Optimistic update: ${endpointId} -> ${newStatus}`);
    
    // Store pending update
    this.pendingUpdates.set(endpointId, {
      status: newStatus,
      timestamp: Date.now()
    });

    // Update UI immediately
    this.updateEndpointStatusInDOM(endpointId, newStatus);
    
    // Broadcast to other tabs
    this.broadcastToOtherTabs('status_changed', { endpointId, status: newStatus });

    // Confirm with server after short delay
    setTimeout(async () => {
      try {
        const response = await fetch(`/api/endpoints/${endpointId}`);
        const data = await response.json();
        
        if (data.success && data.endpoint) {
          const actualStatus = data.endpoint.status;
          
          if (actualStatus !== newStatus) {
            console.warn(`⚠️ Status mismatch detected, reconciling: ${newStatus} -> ${actualStatus}`);
            this.updateEndpointStatusInDOM(endpointId, actualStatus);
            this.showNotification('Status corrected', 'warning');
          } else {
            console.log('✓ Optimistic update confirmed');
          }
        }
        
        this.pendingUpdates.delete(endpointId);
      } catch (error) {
        console.error('Failed to confirm optimistic update:', error);
      }
    }, 2000);
  }

  /**
   * Render parameters section
   */
  renderParameters(parameters) {
    if (!parameters || parameters.length === 0) {
      return '<p class="no-params">No parameters required</p>';
    }

    let html = '<div class="params-section"><h4>Parameters:</h4><ul class="params-list">';
    parameters.forEach(param => {
      const required = param.required ? '<span class="required-badge">Required</span>' : '<span class="optional-badge">Optional</span>';
      html += `
        <li>
          <strong>${param.name}</strong> ${required}
          <br><span class="param-type">${param.type || 'string'}</span>
          ${param.description ? `<br><span class="param-desc">${param.description}</span>` : ''}
        </li>
      `;
    });
    html += '</ul></div>';
    return html;
  }

  /**
   * Render examples section
   */
  renderExamples(endpoint) {
    if (!endpoint.examples || endpoint.examples.length === 0) {
      return '';
    }

    let html = '<div class="examples-section"><h4>Examples:</h4>';
    endpoint.examples.forEach(example => {
      html += `
        <div class="example-item">
          <div class="example-request">
            <strong>Request:</strong>
            <pre><code>${this.escapeHtml(example.request || '')}</code></pre>
          </div>
          ${example.response ? `
            <div class="example-response">
              <strong>Response:</strong>
              <pre><code>${this.escapeHtml(JSON.stringify(example.response, null, 2))}</code></pre>
            </div>
          ` : ''}
        </div>
      `;
    });
    html += '</div>';
    return html;
  }

  /**
   * Get category display name
   */
  getCategoryDisplayName(category) {
    const categoryMap = {
      'social-media': '📱 Social Media',
      'tools': '🛠️ Tools & Utilities',
      'ai': '🤖 AI & Generation',
      'search': '🔍 Search & Info',
      'image': '🖼️ Image Processing',
      'entertainment': '🎬 Entertainment',
      'news': '📰 News & Media',
      'other': '📦 Other'
    };
    return categoryMap[category] || `📦 ${category}`;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Refresh endpoints
   */
  async refresh() {
    console.log('🔄 Refreshing endpoints...');
    return await this.loadEndpoints(true);
  }

  /**
   * Check if SSE is supported (serverless detection)
   */
  async checkSSESupport() {
    try {
      const response = await fetch('/api/sse/status');
      const data = await response.json();
      
      this.sseSupported = data.sse_supported === true;
      this.isServerless = data.serverless === true;
      
      console.log(`📡 SSE status: ${this.sseSupported ? 'supported' : 'not supported (serverless)'}`);
      
      return this.sseSupported;
    } catch (error) {
      console.warn('⚠️ Could not check SSE status, assuming not supported:', error.message);
      this.sseSupported = false;
      this.isServerless = true;
      return false;
    }
  }

  /**
   * Connect to real-time endpoint updates via SSE
   */
  async connectRealtimeUpdates() {
    if (this.eventSource) {
      console.log('⚠️  SSE already connected');
      return;
    }

    // Check if SSE is supported before connecting
    const sseSupported = await this.checkSSESupport();
    
    if (!sseSupported) {
      console.log('📊 SSE not supported in serverless environment, using polling fallback');
      this.updateConnectionStatus('degraded');
      this.enablePolling();
      return;
    }

    console.log('📡 Connecting to real-time endpoint updates...');
    this.updateConnectionStatus('connecting');

    this.eventSource = new EventSource('/sse/endpoint-updates');

    this.eventSource.onopen = () => {
      console.log('✓ Connected to real-time endpoint updates');
      this.reconnectAttempts = 0;
      this.lastSSEActivity = Date.now();
      this.updateConnectionStatus('connected');
      
      // Disable polling if it was enabled
      if (this.pollingEnabled) {
        this.disablePolling();
      }
    };

    this.eventSource.onmessage = (event) => {
      try {
        this.lastSSEActivity = Date.now();
        const data = JSON.parse(event.data);
        this.handleRealtimeEvent(data);
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      this.updateConnectionStatus('disconnected');
      this.eventSource.close();
      this.eventSource = null;

      // Attempt to reconnect with exponential backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`Reconnecting in ${delay / 1000}s... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => this.connectRealtimeUpdates(), delay);
      } else {
        console.error('Max reconnection attempts reached. Enabling polling fallback.');
        this.updateConnectionStatus('degraded');
        this.enablePolling();
      }
    };
  }

  /**
   * Handle real-time events from SSE
   */
  async handleRealtimeEvent(event) {
    console.log('📢 Real-time event received:', event);
    this.lastSSEActivity = Date.now();

    // Add to update history
    this.updateHistory.unshift({
      type: event.type,
      timestamp: event.timestamp || new Date().toISOString(),
      data: event
    });
    
    // Keep only last 50 updates in history
    if (this.updateHistory.length > 50) {
      this.updateHistory = this.updateHistory.slice(0, 50);
    }

    switch (event.type) {
      case 'connected':
        console.log('✓', event.message);
        break;

      case 'endpoint_change':
        await this.handleEndpointChange(event);
        break;

      case 'endpoint_bulk_change':
        await this.handleBulkChange(event);
        break;

      case 'endpoint_sync_complete':
        await this.handleSyncComplete(event);
        break;

      default:
        console.log('Unknown event type:', event.type);
    }
  }

  /**
   * Handle individual endpoint change
   */
  async handleEndpointChange(event) {
    const { action, data } = event;
    
    console.log(`🔄 Endpoint ${action}:`, data.path);

    // Check if this is a pending optimistic update
    if (this.pendingUpdates.has(data.id)) {
      console.log('⚡ Confirming optimistic update');
      this.pendingUpdates.delete(data.id);
    }

    // For status changes, use granular update
    if (action === 'status_changed' || action === 'active_toggled') {
      // Update in cache
      const index = this.endpoints.findIndex(ep => ep.id === data.id);
      if (index !== -1) {
        this.endpoints[index] = data;
      }
      
      // Granular DOM update
      this.updateEndpointInDOM(data);
      
      // Broadcast to other tabs
      this.broadcastToOtherTabs('endpoint_updated', data);
      
      // Show notification
      this.showNotification(`${data.name || data.path}: ${action}`, 'success');
    } else {
      // For other changes, reload and re-render
      this.cache = null;
      await this.loadEndpoints(true);
      this.renderEndpoints();
      
      // Broadcast to other tabs
      this.broadcastToOtherTabs('full_reload', {});
      
      this.showNotification(`Endpoint ${action}: ${data.name || data.path}`, 'info');
    }
  }

  /**
   * Handle bulk endpoint changes
   */
  async handleBulkChange(event) {
    const { action, count } = event;
    
    console.log(`🔄 Bulk ${action}: ${count} endpoints`);

    // Invalidate cache and reload
    this.cache = null;
    await this.loadEndpoints(true);

    // Re-render with stored container selector
    if (typeof this.renderEndpoints === 'function') {
      this.renderEndpoints();
    }

    // Broadcast to other tabs
    this.broadcastToOtherTabs('full_reload', {});

    // Show notification
    this.showNotification(`${count} endpoints updated`, 'info');
  }

  /**
   * Handle sync completion
   */
  async handleSyncComplete(event) {
    const { stats } = event;
    
    console.log('🔄 Sync complete:', stats);

    // Invalidate cache and reload
    this.cache = null;
    await this.loadEndpoints(true);

    // Re-render with stored container selector
    if (typeof this.renderEndpoints === 'function') {
      this.renderEndpoints();
    }

    // Broadcast to other tabs
    this.broadcastToOtherTabs('full_reload', {});

    // Show notification
    this.showNotification(`Sync complete: ${stats.total} endpoints`, 'success');
  }

  /**
   * Show notification to user
   */
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `endpoint-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196f3'};
      color: white;
      border-radius: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      z-index: 10000;
      animation: slideIn 0.3s ease;
      font-size: 14px;
      max-width: 300px;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Disconnect from SSE
   */
  disconnectRealtimeUpdates() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.updateConnectionStatus('disconnected');
      console.log('Disconnected from real-time updates');
    }
  }
  
  /**
   * Cleanup on destroy
   */
  destroy() {
    this.disconnectRealtimeUpdates();
    this.disablePolling();
    
    if (this.sseHealthCheckInterval) {
      clearInterval(this.sseHealthCheckInterval);
    }
    
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    
    if (this.statusIndicator) {
      this.statusIndicator.remove();
    }
  }
}

// Create global instance
window.endpointLoader = new EndpointLoader();

// Auto-load on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await window.endpointLoader.loadEndpoints();
      await window.endpointLoader.loadCategories();
      console.log('✓ Endpoints loaded successfully');
      
      // Connect to real-time updates (async, handles errors internally)
      window.endpointLoader.connectRealtimeUpdates().catch(error => {
        console.warn('⚠️ Failed to connect to real-time updates:', error.message);
        console.log('📊 Falling back to polling mode');
        window.endpointLoader.enablePolling();
      });
    } catch (error) {
      console.error('✗ Failed to auto-load endpoints:', error);
    }
  });
} else {
  // DOM already loaded
  (async () => {
    try {
      await window.endpointLoader.loadEndpoints();
      await window.endpointLoader.loadCategories();
      console.log('✓ Endpoints loaded successfully');
      
      // Connect to real-time updates (async, handles errors internally)
      window.endpointLoader.connectRealtimeUpdates().catch(error => {
        console.warn('⚠️ Failed to connect to real-time updates:', error.message);
        console.log('📊 Falling back to polling mode');
        window.endpointLoader.enablePolling();
      });
    } catch (error) {
      console.error('✗ Failed to auto-load endpoints:', error);
    }
  })();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.endpointLoader) {
    window.endpointLoader.destroy();
  }
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  .endpoint-updated {
    animation: flashUpdate 1s ease;
    position: relative;
  }
  
  @keyframes flashUpdate {
    0%, 100% {
      background: transparent;
    }
    50% {
      background: rgba(76, 175, 80, 0.2);
    }
  }
  
  .status-badge {
    transition: all 0.3s ease;
  }
  
  #endpoint-status-indicator:hover {
    transform: scale(1.1);
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
  }
`;
document.head.appendChild(style);
