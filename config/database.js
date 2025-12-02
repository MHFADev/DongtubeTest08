import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

let sequelize;

const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const isReplit = process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN;

const serverlessPoolConfig = {
  max: 2,
  min: 0,
  acquire: 20000,
  idle: 5000,
  evict: 10000
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

if (useReplitDb) {
  sequelize = new Sequelize(PGDATABASE, PGUSER, PGPASSWORD, {
    host: PGHOST,
    port: PGPORT,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: false
    },
    pool: poolConfig
  });

  console.log(`📊 Using Replit database: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}`);
} else if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
  const DATABASE_URL = process.env.DATABASE_URL;
  const sslRequired = DATABASE_URL.includes('sslmode=require') || isServerless;
  
  sequelize = new Sequelize(DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: sslRequired ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    pool: poolConfig
  });
  
  console.log('📊 Using DATABASE_URL connection');
  if (isServerless) {
    console.log('🔧 Serverless mode: Using optimized connection pool (max: 2, idle: 5s)');
  }
} else if (PGHOST && PGDATABASE) {
  sequelize = new Sequelize(PGDATABASE, PGUSER, PGPASSWORD, {
    host: PGHOST,
    port: PGPORT,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: isServerless ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    pool: poolConfig
  });

  console.log(`📊 Database connected via PG* env vars: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}`);
} else {
  throw new Error('Database configuration missing. Please set DATABASE_URL or PG* environment variables.');
}

export default sequelize;
