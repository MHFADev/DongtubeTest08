import 'dotenv/config';
import { VIPEndpoint } from '../models/index.js';
import { ApiEndpoint, initEndpointDatabase } from '../models/endpoint/index.js';
import chalk from 'chalk';

/**
 * Migrate VIPEndpoint data from primary database to ApiEndpoint in second database
 */
async function migrateEndpoints() {
  console.log(chalk.cyan('\n🔄 Starting endpoint migration...\n'));

  try {
    // Initialize endpoint database
    console.log(chalk.cyan('📊 Initializing endpoint database...'));
    const initialized = await initEndpointDatabase();
    
    if (!initialized) {
      console.error(chalk.red('Failed to initialize endpoint database'));
      process.exit(1);
    }
    
    console.log(chalk.green('✓ Endpoint database initialized\n'));

    // Get all VIP endpoints from primary database
    const vipEndpoints = await VIPEndpoint.findAll();
    
    console.log(chalk.cyan(`📥 Found ${vipEndpoints.length} endpoints in VIPEndpoint table\n`));

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const vipEndpoint of vipEndpoints) {
      try {
        // Check if endpoint already exists in new database
        const existing = await ApiEndpoint.findOne({
          where: {
            path: vipEndpoint.path,
            method: vipEndpoint.method
          }
        });

        if (existing) {
          console.log(chalk.yellow(`  ⏭️  Skipped (exists): ${vipEndpoint.method} ${vipEndpoint.path}`));
          skipped++;
          continue;
        }

        // Migrate endpoint
        await ApiEndpoint.create({
          path: vipEndpoint.path,
          method: vipEndpoint.method,
          name: vipEndpoint.name || vipEndpoint.path,
          description: vipEndpoint.description,
          category: vipEndpoint.category || 'other',
          status: vipEndpoint.requiresVIP ? 'vip' : 'free',
          isActive: true,
          parameters: vipEndpoint.parameters || [],
          examples: null,
          responseType: 'json',
          responseBinary: false,
          priority: 0,
          tags: vipEndpoint.category ? [vipEndpoint.category] : [],
          metadata: {
            migratedFrom: 'VIPEndpoint',
            migratedAt: new Date().toISOString(),
            originalId: vipEndpoint.id
          }
        });

        console.log(chalk.green(`  ✓ Migrated: ${vipEndpoint.method} ${vipEndpoint.path} (${vipEndpoint.requiresVIP ? 'VIP' : 'Free'})`));
        migrated++;
      } catch (error) {
        console.error(chalk.red(`  ✗ Failed to migrate ${vipEndpoint.path}:`), error.message);
        errors++;
      }
    }

    console.log(chalk.bgGreen.black('\n ✓ Migration completed '));
    console.log(chalk.green(`   Migrated: ${migrated}`));
    console.log(chalk.yellow(`   Skipped: ${skipped}`));
    if (errors > 0) {
      console.log(chalk.red(`   Errors: ${errors}`));
    }
    console.log();

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('\n✗ Migration failed:'), error);
    process.exit(1);
  }
}

// Run migration
migrateEndpoints();
