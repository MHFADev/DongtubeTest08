// ============================
// PERFORMANCE DETECTION
// ============================

let devicePerformance = 'high';

function detectDevicePerformance() {
  let score = 0;
  
  // Detect iOS devices (Safari always reports hardwareConcurrency as 2, and no deviceMemory)
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  
  // Check RAM (if available via deviceMemory API)
  if (navigator.deviceMemory) {
    if (navigator.deviceMemory <= 2) score += 4;
    else if (navigator.deviceMemory <= 4) score += 2;
    else if (navigator.deviceMemory <= 8) score += 1;
  } else if (isAndroid) {
    // Android without deviceMemory API is likely old/low-end
    score += 3;
  }
  
  // Check CPU cores (but be careful with iOS which always reports 2)
  const cores = navigator.hardwareConcurrency || 4;
  if (!isIOS) {
    // Only use core count for non-iOS devices
    if (cores <= 2) score += 3;
    else if (cores <= 4) score += 1;
  }
  
  // Check for very old or budget Android devices
  if (isAndroid) {
    // Check screen resolution as additional indicator
    const screenArea = window.screen.width * window.screen.height;
    if (screenArea < 800 * 600) score += 2;
  }
  
  // Run a quick performance benchmark
  const perfScore = runQuickBenchmark();
  score += perfScore;
  
  // Determine performance level with adjusted thresholds
  if (score >= 10) {
    devicePerformance = 'potato';
    console.log('🥔 Potato mode - Maximum optimization for very old devices');
  } else if (score >= 6) {
    devicePerformance = 'low';
    console.log('📱 Low-end mode - Optimized for 2GB RAM phones');
  } else if (score >= 3) {
    devicePerformance = 'medium';
    console.log('💻 Medium mode - Balanced performance');
  } else {
    devicePerformance = 'high';
    console.log('🚀 High performance mode');
  }
  
  // Apply CSS class for conditional styling
  document.body.classList.add(`perf-${devicePerformance}`);
  
  return devicePerformance;
}

function runQuickBenchmark() {
  // Lightweight performance test: measure DOM manipulation speed
  const startTime = performance.now();
  
  // Test 1: Simple arithmetic (very lightweight, ~0.1-2ms)
  let result = 0;
  for (let i = 0; i < 5000; i++) {
    result += i * 0.5;
  }
  
  const duration = performance.now() - startTime;
  
  // Score based on benchmark duration (adjusted for lighter test)
  // Modern devices: <1ms → 0 points
  // Medium devices: 1-3ms → 1 point
  // Old devices: 3-5ms → 2 points
  // Very old devices: >5ms → 4 points
  if (duration > 5) return 4;
  if (duration > 3) return 2;
  if (duration > 1) return 1;
  return 0;
}

// ============================
// THREE.JS 3D BACKGROUND ANIMATION
// ============================

let scene, camera, renderer, particles;
let frameSkip = 0;

function initThreeJS() {
  const canvas = document.getElementById('bg-canvas');
  
  // Detect performance first
  const perf = detectDevicePerformance();
  
  // Disable Three.js completely for potato devices
  if (perf === 'potato') {
    canvas.style.display = 'none';
    addCSSFallback();
    return;
  }
  
  // Scene
  scene = new THREE.Scene();
  
  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 50;
  
  // Renderer - optimized based on device performance
  const pixelRatio = perf === 'low' ? 1 : Math.min(window.devicePixelRatio, 1.5);
  renderer = new THREE.WebGLRenderer({ 
    canvas, 
    alpha: true, 
    antialias: false,
    powerPreference: perf === 'high' ? 'default' : 'low-power'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(pixelRatio);
  
  // Create floating 3D objects
  particles = [];
  
  // Simpler geometries for low-end devices
  const geometries = perf === 'low' 
    ? [new THREE.BoxGeometry(2, 2, 2), new THREE.TetrahedronGeometry(1.5)]
    : [
        new THREE.BoxGeometry(2, 2, 2),
        new THREE.TetrahedronGeometry(1.5),
        new THREE.OctahedronGeometry(1.5),
        new THREE.TorusGeometry(1, 0.4, 8, 16)
      ];
  
  const material = new THREE.MeshBasicMaterial({
    color: 0xffcc00,
    wireframe: true,
    transparent: true,
    opacity: perf === 'low' ? 0.2 : 0.3
  });
  
  // Adjust particle count based on performance
  const particleCount = perf === 'low' ? 6 : (perf === 'medium' ? 12 : 19);
  
  for (let i = 0; i < particleCount; i++) {
    const geometry = geometries[Math.floor(Math.random() * geometries.length)];
    const mesh = new THREE.Mesh(geometry, material);
    
    // Random position
    mesh.position.x = (Math.random() - 0.5) * 100;
    mesh.position.y = (Math.random() - 0.5) * 100;
    mesh.position.z = (Math.random() - 0.5) * 100;
    
    // Random rotation speed
    mesh.rotation.x = Math.random() * Math.PI;
    mesh.rotation.y = Math.random() * Math.PI;
    
    // Slower movement for low-end devices
    const speedMultiplier = perf === 'low' ? 0.5 : 1;
    mesh.userData.velocity = {
      x: (Math.random() - 0.5) * 0.02 * speedMultiplier,
      y: (Math.random() - 0.5) * 0.02 * speedMultiplier,
      z: (Math.random() - 0.5) * 0.02 * speedMultiplier
    };
    
    mesh.userData.rotationSpeed = {
      x: (Math.random() - 0.5) * 0.02 * speedMultiplier,
      y: (Math.random() - 0.5) * 0.02 * speedMultiplier,
      z: (Math.random() - 0.5) * 0.02 * speedMultiplier
    };
    
    scene.add(mesh);
    particles.push(mesh);
  }
  
  // Handle window resize with debounce for better performance
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }, 200);
  });
  
  // Start animation
  animate();
}

let isAnimating = true;
let animationFrameId;

function animate() {
  if (!isAnimating) return;
  
  animationFrameId = requestAnimationFrame(animate);
  
  // Frame skipping for low-end devices (render every 2nd frame)
  if (devicePerformance === 'low') {
    frameSkip++;
    if (frameSkip % 2 !== 0) return;
  }
  
  // Animate each particle
  particles.forEach(particle => {
    // Move particle
    particle.position.x += particle.userData.velocity.x;
    particle.position.y += particle.userData.velocity.y;
    particle.position.z += particle.userData.velocity.z;
    
    // Rotate particle
    particle.rotation.x += particle.userData.rotationSpeed.x;
    particle.rotation.y += particle.userData.rotationSpeed.y;
    particle.rotation.z += particle.userData.rotationSpeed.z;
    
    // Bounce particles at boundaries
    if (Math.abs(particle.position.x) > 50) particle.userData.velocity.x *= -1;
    if (Math.abs(particle.position.y) > 50) particle.userData.velocity.y *= -1;
    if (Math.abs(particle.position.z) > 50) particle.userData.velocity.z *= -1;
  });
  
  // Disable camera rotation for low-end devices
  if (devicePerformance !== 'low') {
    camera.position.x = Math.sin(Date.now() * 0.0001) * 5;
    camera.position.y = Math.cos(Date.now() * 0.0001) * 5;
    camera.lookAt(scene.position);
  }
  
  renderer.render(scene, camera);
}

// Pause animation when tab is not visible (save CPU/GPU resources)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    isAnimating = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  } else {
    isAnimating = true;
    animate();
  }
});

// Initialize Three.js when page loads
window.addEventListener('load', () => {
  if (typeof THREE !== 'undefined') {
    try {
      initThreeJS();
    } catch (error) {
      console.log('WebGL not supported, using CSS fallback');
      // Fallback: Add CSS animation if WebGL fails
      document.getElementById('bg-canvas').style.display = 'none';
      addCSSFallback();
    }
  }
});

// CSS Fallback Animation
function addCSSFallback() {
  const style = document.createElement('style');
  style.textContent = `
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 20% 50%, rgba(255, 204, 0, 0.1) 0%, transparent 50%),
                  radial-gradient(circle at 80% 80%, rgba(255, 204, 0, 0.08) 0%, transparent 50%),
                  radial-gradient(circle at 40% 20%, rgba(255, 204, 0, 0.06) 0%, transparent 50%);
      animation: bgPulse 15s ease-in-out infinite;
      z-index: 0;
      pointer-events: none;
    }
    @keyframes bgPulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// ============================
// TIKTOK DOWNLOADER LOGIC
// ============================

// DOM Elements
const urlInput = document.getElementById('urlInput');
const downloadBtn = document.getElementById('downloadBtn');
const loading = document.getElementById('loading');
const result = document.getElementById('result');
const error = document.getElementById('error');
const errorMsg = document.getElementById('errorMsg');
const retryBtn = document.getElementById('retryBtn');
const downloadVideoBtn = document.getElementById('downloadVideoBtn');
const downloadText = document.getElementById('downloadText');
const downloadProgress = document.getElementById('downloadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// Event Listeners
downloadBtn.addEventListener('click', handleDownload);
urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleDownload();
});
retryBtn.addEventListener('click', reset);

// Main Handler
async function handleDownload() {
  const url = urlInput.value.trim();
  
  if (!url) {
    showError('Masukkan URL TikTok');
    return;
  }
  
  if (!/^https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i.test(url)) {
    showError('URL tidak valid');
    return;
  }
  
  showLoading();
  
  try {
    const data = await fetchVideo(url);
    displayResult(data);
  } catch (err) {
    showError('Gagal mengunduh video');
  }
}

// Fetch Video
async function fetchVideo(url) {
  const res = await fetch(`https://www.dongtube.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`);
  const data = await res.json();
  
  if (!data.success || !data.data) {
    throw new Error('Invalid response');
  }
  
  return data.data;
}

// Display Result
function displayResult(data) {
  hideAll();
  
  const thumbnail = document.getElementById('thumbnail');
  const title = document.getElementById('title');
  const author = document.getElementById('author');
  const stats = document.getElementById('stats');
  
  thumbnail.src = data.cover || data.origin_cover || '';
  title.textContent = data.title || 'TikTok Video';
  author.textContent = '@' + (data.author?.nickname || data.author?.unique_id || 'Unknown');
  
  const views = data.play_count ? `👁️ ${formatNum(data.play_count)}` : '';
  const likes = data.digg_count ? `❤️ ${formatNum(data.digg_count)}` : '';
  const comments = data.comment_count ? `💬 ${formatNum(data.comment_count)}` : '';
  const shares = data.share_count ? `🔄 ${formatNum(data.share_count)}` : '';
  
  const statsHtml = [views, likes, comments, shares].filter(s => s).map(s => `<span>${s}</span>`).join('');
  stats.innerHTML = statsHtml;
  
  const videoUrl = data.play || data.wmplay || '';
  const videoUrlHD = data.play || '';
  const videoUrlSD = data.wmplay || '';
  
  if (!videoUrl) {
    showError('Video tidak tersedia');
    return;
  }
  
  // Store current video data with multiple qualities
  currentVideoData = {
    ...data,
    videoUrl: videoUrl,
    videoUrlHD: videoUrlHD,
    videoUrlSD: videoUrlSD,
    selectedQuality: videoUrlHD ? 'HD' : 'SD'
  };
  
  // Show quality selector if both qualities available
  const qualitySelector = document.getElementById('qualitySelector');
  if (qualitySelector) {
    if (videoUrlHD && videoUrlSD && videoUrlHD !== videoUrlSD) {
      qualitySelector.classList.remove('hidden');
      updateQualityButtons();
    } else {
      qualitySelector.classList.add('hidden');
    }
  }
  
  result.classList.remove('hidden');
  downloadBtn.disabled = false;
  urlInput.disabled = false;
  
  // Download handler with selected quality
  downloadVideoBtn.onclick = () => {
    const selectedUrl = currentVideoData.selectedQuality === 'HD' ? currentVideoData.videoUrlHD : currentVideoData.videoUrlSD;
    startDownload(selectedUrl, data.title || 'TikTok Video');
  };
}

// Start Download with Progress
async function startDownload(url, videoTitle) {
  downloadVideoBtn.disabled = true;
  downloadText.textContent = '⏳ Memproses...';
  downloadProgress.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = 'Menyiapkan download...';
  
  try {
    // Clean filename
    const filename = sanitizeFilename(videoTitle) + '.mp4';
    
    // Animate progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 15;
      if (progress > 90) progress = 90;
      progressFill.style.width = progress + '%';
      progressText.textContent = `Memproses... ${progress}%`;
    }, 200);
    
    // Try download attribute approach first (works in some browsers)
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    // Small delay before removing
    setTimeout(() => {
      document.body.removeChild(link);
    }, 100);
    
    // Complete progress animation
    setTimeout(() => {
      clearInterval(interval);
      progressFill.style.width = '100%';
      progressText.textContent = 'Download dimulai!';
      downloadText.textContent = '✅ Berhasil';
      
      // Save to history
      saveToHistory({
        title: videoTitle,
        url: url,
        filename: filename,
        timestamp: Date.now()
      });
      
      // Show notification with instructions
      showNotification('✅ Download dimulai!', `Video "${videoTitle}" sedang diunduh. Jika tidak otomatis, klik kanan pada video dan pilih "Save video as..."`, 'success');
      
      setTimeout(() => {
        downloadProgress.classList.add('hidden');
        downloadText.textContent = '📥 Download Lagi';
        downloadVideoBtn.disabled = false;
        progressFill.style.width = '0%';
        progressText.textContent = 'Menyiapkan download...';
      }, 3000);
    }, 1000);
    
  } catch (err) {
    console.error('Download error:', err);
    downloadProgress.classList.add('hidden');
    downloadText.textContent = '❌ Gagal';
    progressText.textContent = 'Download gagal';
    showNotification('❌ Download gagal', 'Terjadi kesalahan saat mengunduh video. Coba lagi.', 'error');
    setTimeout(() => {
      downloadText.textContent = '📥 Download Video';
      downloadVideoBtn.disabled = false;
      progressFill.style.width = '0%';
    }, 2000);
  }
}

// Sanitize filename
function sanitizeFilename(name) {
  return name
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

// UI States
function showLoading() {
  hideAll();
  downloadBtn.disabled = true;
  urlInput.disabled = true;
  loading.classList.remove('hidden');
}

function showError(msg) {
  hideAll();
  errorMsg.textContent = msg;
  error.classList.remove('hidden');
  downloadBtn.disabled = false;
  urlInput.disabled = false;
}

function hideAll() {
  loading.classList.add('hidden');
  result.classList.add('hidden');
  error.classList.add('hidden');
  downloadProgress.classList.add('hidden');
}

function reset() {
  urlInput.value = '';
  hideAll();
  downloadBtn.disabled = false;
  urlInput.disabled = false;
  urlInput.focus();
}

// Format Numbers
function formatNum(num) {
  const n = parseInt(num);
  if (isNaN(n)) return num;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

// ============================
// NOTIFICATION SYSTEM
// ============================

function showNotification(title, message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-title">${title}</div>
      <div class="notification-message">${message}</div>
    </div>
    <button class="notification-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  document.body.appendChild(notification);
  
  // Trigger animation
  setTimeout(() => notification.classList.add('show'), 10);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// ============================
// DOWNLOAD HISTORY
// ============================

function saveToHistory(download) {
  const history = getDownloadHistory();
  history.unshift(download);
  
  // Keep only last 50 downloads
  if (history.length > 50) history.pop();
  
  localStorage.setItem('downloadHistory', JSON.stringify(history));
  updateStats();
  updateHistoryUI();
}

function getDownloadHistory() {
  const history = localStorage.getItem('downloadHistory');
  return history ? JSON.parse(history) : [];
}

function clearHistory() {
  if (confirm('Hapus semua riwayat download?')) {
    localStorage.removeItem('downloadHistory');
    updateStats();
    updateHistoryUI();
    showNotification('🗑️ Riwayat dihapus', 'Semua riwayat download telah dihapus', 'success');
  }
}

function updateHistoryUI() {
  const historyContainer = document.getElementById('historyList');
  const history = getDownloadHistory();
  
  if (!historyContainer) return;
  
  if (history.length === 0) {
    historyContainer.innerHTML = '<div class="history-empty">Belum ada riwayat download</div>';
    return;
  }
  
  historyContainer.innerHTML = history.map((item, index) => `
    <div class="history-item" data-index="${index}">
      <div class="history-info">
        <div class="history-title">${item.title}</div>
        <div class="history-time">${formatTime(item.timestamp)}</div>
      </div>
      <button class="history-redownload" onclick="redownloadFromHistory(${index})" title="Download lagi">
        ↻
      </button>
    </div>
  `).join('');
}

async function redownloadFromHistory(index) {
  const history = getDownloadHistory();
  const item = history[index];
  if (item) {
    await startDownload(item.url, item.title);
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  return `${days} hari lalu`;
}

// ============================
// DOWNLOAD STATISTICS
// ============================

function updateStats() {
  const history = getDownloadHistory();
  const statsCount = document.getElementById('statsCount');
  
  if (statsCount) {
    statsCount.textContent = history.length;
  }
}

// ============================
// VIDEO PREVIEW
// ============================

let currentVideoData = null;

function showVideoPreview(videoUrl, thumbnailUrl) {
  const preview = document.getElementById('videoPreview');
  const videoPlayer = document.getElementById('videoPlayer');
  const videoPoster = document.getElementById('videoPoster');
  
  if (!preview || !videoPlayer) return;
  
  videoPlayer.src = videoUrl;
  videoPlayer.poster = thumbnailUrl;
  preview.classList.remove('hidden');
  
  // Auto play
  videoPlayer.play().catch(() => {
    // Ignore autoplay errors
  });
}

function hideVideoPreview() {
  const preview = document.getElementById('videoPreview');
  const videoPlayer = document.getElementById('videoPlayer');
  
  if (preview && videoPlayer) {
    videoPlayer.pause();
    videoPlayer.src = '';
    preview.classList.add('hidden');
  }
}

// ============================
// SHARE FUNCTIONALITY
// ============================

async function shareVideo() {
  if (!currentVideoData) return;
  
  const shareData = {
    title: currentVideoData.title || 'TikTok Video',
    text: `Check out this video: ${currentVideoData.title}`,
    url: window.location.href
  };
  
  try {
    if (navigator.share) {
      await navigator.share(shareData);
      showNotification('✅ Berhasil dibagikan!', 'Video telah dibagikan', 'success');
    } else {
      // Fallback: copy link
      await copyVideoLink();
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Share error:', err);
    }
  }
}

async function copyVideoLink() {
  const urlInput = document.getElementById('urlInput');
  const url = urlInput.value.trim();
  
  try {
    await navigator.clipboard.writeText(url);
    showNotification('📋 Link disalin!', 'Link video telah disalin ke clipboard', 'success');
  } catch (err) {
    console.error('Copy error:', err);
    showNotification('❌ Gagal menyalin', 'Tidak dapat menyalin link', 'error');
  }
}

// ============================
// QUALITY SELECTION
// ============================

function selectQuality(quality) {
  if (!currentVideoData) return;
  
  currentVideoData.selectedQuality = quality;
  updateQualityButtons();
  
  // Update video preview if open
  const videoPlayer = document.getElementById('videoPlayer');
  if (videoPlayer && videoPlayer.src) {
    const newUrl = quality === 'HD' ? currentVideoData.videoUrlHD : currentVideoData.videoUrlSD;
    videoPlayer.src = newUrl;
  }
}

function updateQualityButtons() {
  const hdBtn = document.getElementById('qualityHD');
  const sdBtn = document.getElementById('qualitySD');
  
  if (!hdBtn || !sdBtn || !currentVideoData) return;
  
  if (currentVideoData.selectedQuality === 'HD') {
    hdBtn.classList.add('active');
    sdBtn.classList.remove('active');
  } else {
    sdBtn.classList.add('active');
    hdBtn.classList.remove('active');
  }
}

// ============================
// TOGGLE SECTIONS
// ============================

function toggleHistory() {
  const historySection = document.getElementById('historySection');
  if (historySection) {
    historySection.classList.toggle('hidden');
    if (!historySection.classList.contains('hidden')) {
      updateHistoryUI();
    }
  }
}

// ============================
// INITIALIZATION
// ============================

// Focus input on load
setTimeout(() => {
  urlInput.focus();
  updateStats();
}, 100);
