import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

let sequelize = null;
let databaseConfigured = false;
let configurationError = null;

const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const isReplit = !!(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN);

const serverlessPoolConfig = {
  max: 1,
  min: 0,
  acquire: 10000,
  idle: 0,
  evict: 60000
};

const standardPoolConfig = {
  max: 5,
  min: 0,
  acquire: 30000,
  idle: 10000
};

const poolConfig = isServerless ? serverlessPoolConfig : standardPoolConfig;

const PGHOST = process.env.PGHOST;
const PGPORT = process.env.PGPORT || 5432;
const PGUSER = process.env.PGUSER || 'postgres';
const PGDATABASE = process.env.PGDATABASE;
const PGPASSWORD = process.env.PGPASSWORD || '';

const useReplitDb = isReplit && PGHOST && PGDATABASE;

function createSequelizeInstance() {
  try {
    if (useReplitDb) {
      const instance = new Sequelize(PGDATABASE, PGUSER, PGPASSWORD, {
        host: PGHOST,
        port: PGPORT,
        dialect: 'postgres',
        dialectModule: pg,
        logging: false,
        dialectOptions: {
          ssl: false,
          connectTimeout: 10000
        },
        pool: poolConfig,
        retry: {
          max: 3,
          backoffBase: 1000,
          backoffExponent: 1.5
        }
      });
      
      console.log(`📊 Using Replit database: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}`);
      return instance;
    }
    
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
      const DATABASE_URL = process.env.DATABASE_URL;
      // Fix for Vercel/Railway self-signed certificate issue.
      // Railway uses a public TCP proxy with self-signed certs, requiring SSL with rejectUnauthorized: false
      const sslRequired = DATABASE_URL.includes('sslmode=require') || 
                          DATABASE_URL.includes('neon.tech') || 
                          DATABASE_URL.includes('supabase') ||
                          DATABASE_URL.includes('railway.app') ||
                          DATABASE_URL.includes('railway.internal') ||
                          process.env.RAILWAY_ENVIRONMENT ||
                          isServerless;
      
      const instance = new Sequelize(DATABASE_URL, {
        dialect: 'postgres',
        dialectModule: pg,
        logging: false,
        dialectOptions: {
          ssl: sslRequired ? {
            require: true,
            rejectUnauthorized: false
          } : false,
          connectTimeout: isServerless ? 10000 : 30000,
          statement_timeout: isServerless ? 25000 : 60000,
          idle_in_transaction_session_timeout: isServerless ? 10000 : 60000
        },
        pool: poolConfig,
        retry: {
          max: 3,
          backoffBase: 1000,
          backoffExponent: 1.5
        }
      });
      
      console.log('📊 Using DATABASE_URL connection');
      if (sslRequired) {
        console.log('🔒 SSL mode enabled for database connection');
      }
      if (isServerless) {
        console.log('🔧 Serverless mode: Using optimized connection pool (max: 1, idle: 0)');
      }
      return instance;
    }
    
    if (PGHOST && PGDATABASE) {
      const instance = new Sequelize(PGDATABASE, PGUSER, PGPASSWORD, {
        host: PGHOST,
        port: PGPORT,
        dialect: 'postgres',
        dialectModule: pg,
        logging: false,
        dialectOptions: {
          ssl: isServerless ? {
            require: true,
            rejectUnauthorized: false
          } : false,
          connectTimeout: isServerless ? 10000 : 30000
        },
        pool: poolConfig,
        retry: {
          max: 3,
          backoffBase: 1000,
          backoffExponent: 1.5
        }
      });
      
      console.log(`📊 Database connected via PG* env vars: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}`);
      return instance;
    }
    
    console.warn('⚠️ No database configuration found. Running in degraded mode.');
    console.warn('   Please set DATABASE_URL or PG* environment variables.');
    configurationError = new Error('Database configuration missing. Please set DATABASE_URL or PG* environment variables.');
    return null;
    
  } catch (error) {
    console.error('❌ Failed to create database connection:', error.message);
    configurationError = error;
    return null;
  }
}

sequelize = createSequelizeInstance();
databaseConfigured = sequelize !== null;

export function isDatabaseConfigured() {
  return databaseConfigured;
}

export function getDatabaseError() {
  return configurationError;
}

export async function testConnection() {
  if (!sequelize) {
    return { success: false, error: 'No database configuration' };
  }
  
  try {
    await sequelize.authenticate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default sequelize;
