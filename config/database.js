import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

let sequelize;

const DATABASE_URL = process.env.DATABASE_URL;
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

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

if (DATABASE_URL && DATABASE_URL.trim() !== '') {
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
  
  if (isServerless) {
    console.log('🔧 Serverless mode: Using optimized connection pool (max: 2, idle: 5s)');
  }
} else {
  const PGHOST = process.env.PGHOST;
  const PGPORT = process.env.PGPORT || 5432;
  const PGUSER = process.env.PGUSER || 'postgres';
  const PGDATABASE = process.env.PGDATABASE;
  const PGPASSWORD = process.env.PGPASSWORD || '';

  if (!PGHOST || !PGDATABASE) {
    throw new Error('Database configuration missing. Please set DATABASE_URL or PG* environment variables.');
  }

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

  console.log(`📊 Database connected via individual env vars: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}`);
  
  if (isServerless) {
    console.log('🔧 Serverless mode: Using optimized connection pool (max: 2, idle: 5s)');
  }
}

export default sequelize;
