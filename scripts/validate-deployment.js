#!/usr/bin/env node

/**
 * Deployment Validation Script
 * Validates that all requirements are met before deploying to Vercel
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkmark() {
  return `${colors.green}✓${colors.reset}`;
}

function crossmark() {
  return `${colors.red}✗${colors.reset}`;
}

function warning() {
  return `${colors.yellow}⚠${colors.reset}`;
}

let errors = 0;
let warnings = 0;

console.log('\n' + '='.repeat(60));
log('  🚀 VERCEL DEPLOYMENT VALIDATION', 'cyan');
console.log('='.repeat(60) + '\n');

// ==================== Check 1: Required Files ====================
log('📁 Checking Required Files...', 'blue');

const requiredFiles = [
  'api/index.js',
  'vercel.json',
  'package.json',
  '.gitignore',
  '.env.example'
];

requiredFiles.forEach(file => {
  const filePath = join(rootDir, file);
  if (existsSync(filePath)) {
    log(`  ${checkmark()} ${file}`, 'green');
  } else {
    log(`  ${crossmark()} ${file} NOT FOUND`, 'red');
    errors++;
  }
});

console.log();

// ==================== Check 2: Package.json ====================
log('📦 Checking package.json...', 'blue');

try {
  const pkgPath = join(rootDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  
  // Check required fields
  if (pkg.name) {
    log(`  ${checkmark()} Package name: ${pkg.name}`, 'green');
  } else {
    log(`  ${crossmark()} Package name missing`, 'red');
    errors++;
  }
  
  if (pkg.version) {
    log(`  ${checkmark()} Version: ${pkg.version}`, 'green');
  } else {
    log(`  ${warning()} Version missing`, 'yellow');
    warnings++;
  }
  
  // Check type: module
  if (pkg.type === 'module') {
    log(`  ${checkmark()} Type: module (ES6)`, 'green');
  } else {
    log(`  ${crossmark()} Type must be "module" for ES6 imports`, 'red');
    errors++;
  }
  
  // Check Node version
  if (pkg.engines && pkg.engines.node) {
    log(`  ${checkmark()} Node version requirement: ${pkg.engines.node}`, 'green');
  } else {
    log(`  ${warning()} Node version not specified in engines`, 'yellow');
    warnings++;
  }
  
  // Check critical dependencies
  const requiredDeps = [
    'express',
    'dotenv',
    'pg',
    'sequelize',
    'jsonwebtoken',
    'bcryptjs'
  ];
  
  const missingDeps = requiredDeps.filter(dep => !pkg.dependencies || !pkg.dependencies[dep]);
  
  if (missingDeps.length === 0) {
    log(`  ${checkmark()} All critical dependencies present`, 'green');
  } else {
    log(`  ${crossmark()} Missing dependencies: ${missingDeps.join(', ')}`, 'red');
    errors++;
  }
  
} catch (err) {
  log(`  ${crossmark()} Failed to parse package.json: ${err.message}`, 'red');
  errors++;
}

console.log();

// ==================== Check 3: Vercel Configuration ====================
log('⚙️  Checking vercel.json...', 'blue');

try {
  const vercelPath = join(rootDir, 'vercel.json');
  const vercel = JSON.parse(readFileSync(vercelPath, 'utf-8'));
  
  // Check version
  if (vercel.version === 2) {
    log(`  ${checkmark()} Vercel version: 2`, 'green');
  } else {
    log(`  ${crossmark()} Vercel version should be 2`, 'red');
    errors++;
  }
  
  // Check builds
  if (vercel.builds && vercel.builds.length > 0) {
    log(`  ${checkmark()} Builds configured`, 'green');
    
    const hasApiIndex = vercel.builds.some(b => 
      b.src && b.src.includes('api/index.js') && b.use === '@vercel/node'
    );
    
    if (hasApiIndex) {
      log(`  ${checkmark()} API entry point configured`, 'green');
    } else {
      log(`  ${crossmark()} API entry point (api/index.js) not properly configured`, 'red');
      errors++;
    }
  } else {
    log(`  ${warning()} No builds configured`, 'yellow');
    warnings++;
  }
  
  // Check routes
  if (vercel.routes && vercel.routes.length > 0) {
    log(`  ${checkmark()} Routes configured`, 'green');
  } else {
    log(`  ${warning()} No routes configured`, 'yellow');
    warnings++;
  }
  
  // Check functions config
  if (vercel.functions && vercel.functions['api/index.js']) {
    const fnConfig = vercel.functions['api/index.js'];
    
    if (fnConfig.maxDuration) {
      log(`  ${checkmark()} Max duration: ${fnConfig.maxDuration}s`, 'green');
      
      if (fnConfig.maxDuration < 10) {
        log(`  ${warning()} Max duration is very short, consider increasing`, 'yellow');
        warnings++;
      }
    }
    
    if (fnConfig.memory) {
      log(`  ${checkmark()} Memory: ${fnConfig.memory}MB`, 'green');
    }
  }
  
} catch (err) {
  log(`  ${crossmark()} Failed to parse vercel.json: ${err.message}`, 'red');
  errors++;
}

console.log();

// ==================== Check 4: API Entry Point ====================
log('🔧 Checking API entry point...', 'blue');

try {
  const apiPath = join(rootDir, 'api', 'index.js');
  const apiContent = readFileSync(apiPath, 'utf-8');
  
  // Check for export default handler
  if (apiContent.includes('export default') && 
      (apiContent.includes('function handler') || apiContent.includes('async function handler'))) {
    log(`  ${checkmark()} Default export handler found`, 'green');
  } else {
    log(`  ${crossmark()} Default export handler not found`, 'red');
    errors++;
  }
  
  // Check for dotenv import
  if (apiContent.includes("import 'dotenv/config'") || 
      apiContent.includes('import dotenv') ||
      apiContent.includes('require("dotenv")')) {
    log(`  ${checkmark()} Environment configuration present`, 'green');
  } else {
    log(`  ${warning()} dotenv not imported (env vars may not load)`, 'yellow');
    warnings++;
  }
  
  // Check for error handling
  if (apiContent.includes('try') && apiContent.includes('catch')) {
    log(`  ${checkmark()} Error handling present`, 'green');
  } else {
    log(`  ${warning()} No try-catch blocks found`, 'yellow');
    warnings++;
  }
  
  // Check for database initialization
  if (apiContent.includes('initDatabase') || apiContent.includes('sequelize')) {
    log(`  ${checkmark()} Database initialization code found`, 'green');
  } else {
    log(`  ${warning()} No database initialization found`, 'yellow');
    warnings++;
  }
  
} catch (err) {
  log(`  ${crossmark()} Failed to read api/index.js: ${err.message}`, 'red');
  errors++;
}

console.log();

// ==================== Check 5: Environment Variables ====================
log('🔐 Checking environment variables...', 'blue');

const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];

// Check .env.example
try {
  const envExamplePath = join(rootDir, '.env.example');
  const envExample = readFileSync(envExamplePath, 'utf-8');
  
  const hasAllVars = requiredEnvVars.every(varName => 
    envExample.includes(varName + '=')
  );
  
  if (hasAllVars) {
    log(`  ${checkmark()} .env.example contains all required variables`, 'green');
  } else {
    const missing = requiredEnvVars.filter(v => !envExample.includes(v + '='));
    log(`  ${warning()} .env.example missing: ${missing.join(', ')}`, 'yellow');
    warnings++;
  }
} catch (err) {
  log(`  ${warning()} .env.example not found or unreadable`, 'yellow');
  warnings++;
}

// Remind about production env vars
log(`\n  ${warning()} REMINDER: Set these in Vercel Dashboard:`, 'yellow');
requiredEnvVars.forEach(varName => {
  log(`    - ${varName}`, 'yellow');
});

console.log();

// ==================== Check 6: Git Configuration ====================
log('📝 Checking Git configuration...', 'blue');

try {
  const gitignorePath = join(rootDir, '.gitignore');
  const gitignore = readFileSync(gitignorePath, 'utf-8');
  
  const criticalIgnores = ['.env', 'node_modules', '.vercel'];
  const missingIgnores = criticalIgnores.filter(item => !gitignore.includes(item));
  
  if (missingIgnores.length === 0) {
    log(`  ${checkmark()} .gitignore properly configured`, 'green');
  } else {
    log(`  ${warning()} .gitignore missing: ${missingIgnores.join(', ')}`, 'yellow');
    warnings++;
  }
  
  // Check if .env is committed (bad!)
  if (existsSync(join(rootDir, '.env'))) {
    log(`  ${warning()} .env file exists locally (ensure it's not committed!)`, 'yellow');
    warnings++;
  }
  
} catch (err) {
  log(`  ${warning()} .gitignore check failed: ${err.message}`, 'yellow');
  warnings++;
}

console.log();

// ==================== Check 7: Database Models ====================
log('🗄️  Checking database models...', 'blue');

const modelFiles = ['models/index.js', 'models/User.js'];
let modelsOk = true;

modelFiles.forEach(file => {
  if (existsSync(join(rootDir, file))) {
    log(`  ${checkmark()} ${file}`, 'green');
  } else {
    log(`  ${warning()} ${file} not found`, 'yellow');
    warnings++;
    modelsOk = false;
  }
});

if (modelsOk) {
  log(`  ${checkmark()} Database models present`, 'green');
}

console.log();

// ==================== Check 8: Static Files ====================
log('📂 Checking static files...', 'blue');

const publicDir = join(rootDir, 'public');
if (existsSync(publicDir)) {
  log(`  ${checkmark()} public/ directory exists`, 'green');
  
  const indexHtml = join(publicDir, 'index.html');
  if (existsSync(indexHtml)) {
    log(`  ${checkmark()} public/index.html exists`, 'green');
  } else {
    log(`  ${warning()} public/index.html not found`, 'yellow');
    warnings++;
  }
} else {
  log(`  ${warning()} public/ directory not found`, 'yellow');
  warnings++;
}

console.log();

// ==================== Summary ====================
console.log('='.repeat(60));

if (errors === 0 && warnings === 0) {
  log('  ✨ VALIDATION PASSED! All checks successful!', 'green');
  log('  🚀 Ready to deploy to Vercel!', 'green');
} else if (errors === 0) {
  log(`  ${warning()} VALIDATION PASSED WITH WARNINGS (${warnings})`, 'yellow');
  log('  ⚠️  Please review warnings before deploying', 'yellow');
} else {
  log(`  ${crossmark()} VALIDATION FAILED`, 'red');
  log(`  ❌ ${errors} error(s), ${warnings} warning(s) found`, 'red');
  log('  🛠️  Please fix errors before deploying', 'red');
}

console.log('='.repeat(60) + '\n');

// Exit with appropriate code
process.exit(errors > 0 ? 1 : 0);
