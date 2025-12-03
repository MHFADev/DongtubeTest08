import sequelize, { isDatabaseConfigured } from '../../config/database.js';
import ApiEndpoint from './ApiEndpoint.js';
import EndpointCategory from './EndpointCategory.js';
import EndpointUsageStats from './EndpointUsageStats.js';

if (sequelize) {
  ApiEndpoint.hasMany(EndpointUsageStats, {
    foreignKey: 'endpoint_id',
    as: 'usageStats',
    onDelete: 'CASCADE'
  });

  EndpointUsageStats.belongsTo(ApiEndpoint, {
    foreignKey: 'endpoint_id',
    as: 'endpoint'
  });
}

const initEndpointDatabase = async () => {
  if (!isDatabaseConfigured() || !sequelize) {
    console.warn('⚠️ Cannot initialize endpoint tables: Database not configured');
    return false;
  }
  
  try {
    console.log('📊 Syncing endpoint tables (in primary database)...');
    
    await EndpointCategory.sync();
    console.log('  ✓ EndpointCategory table synced');
    
    await ApiEndpoint.sync();
    console.log('  ✓ ApiEndpoint table synced');
    
    await EndpointUsageStats.sync();
    console.log('  ✓ EndpointUsageStats table synced');
    
    console.log('✓ Endpoint tables synced (in primary database)');
    
    // Create default categories if they don't exist
    const defaultCategories = [
      {
        name: 'social-media',
        displayName: 'Social Media',
        description: 'Social media downloaders and tools (TikTok, Instagram, YouTube, etc.)',
        icon: '📱',
        color: '#FF6B6B',
        priority: 100
      },
      {
        name: 'tools',
        displayName: 'Tools & Utilities',
        description: 'Various utility tools and converters',
        icon: '🛠️',
        color: '#4ECDC4',
        priority: 90
      },
      {
        name: 'ai',
        displayName: 'AI & Generation',
        description: 'AI-powered tools and content generation',
        icon: '🤖',
        color: '#95E1D3',
        priority: 80
      },
      {
        name: 'search',
        displayName: 'Search & Info',
        description: 'Search engines and information retrieval',
        icon: '🔍',
        color: '#F38181',
        priority: 70
      },
      {
        name: 'image',
        displayName: 'Image Processing',
        description: 'Image manipulation and processing tools',
        icon: '🖼️',
        color: '#AA96DA',
        priority: 60
      },
      {
        name: 'entertainment',
        displayName: 'Entertainment',
        description: 'Anime, music, and entertainment content',
        icon: '🎬',
        color: '#FCBAD3',
        priority: 50
      },
      {
        name: 'news',
        displayName: 'News & Media',
        description: 'News aggregation and media content',
        icon: '📰',
        color: '#FFFFD2',
        priority: 40
      },
      {
        name: 'other',
        displayName: 'Other',
        description: 'Miscellaneous endpoints',
        icon: '📦',
        color: '#A8D8EA',
        priority: 10
      }
    ];
    
    for (const category of defaultCategories) {
      await EndpointCategory.findOrCreate({
        where: { name: category.name },
        defaults: category
      });
    }
    
    console.log('✓ Default categories initialized');
    
    return true;
  } catch (error) {
    console.error('✗ Endpoint tables error:', error.message);
    return false;
  }
};

export {
  sequelize,
  ApiEndpoint,
  EndpointCategory,
  EndpointUsageStats,
  initEndpointDatabase
};
