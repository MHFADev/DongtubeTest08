import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

let endpointSequelize;

// Database URL untuk endpoint management (Database Kedua)
const ENDPOINT_DATABASE_URL = process.env.ENDPOINT_DATABASE_URL;

if (ENDPOINT_DATABASE_URL && ENDPOINT_DATABASE_URL.trim() !== '') {
  endpointSequelize = new Sequelize(ENDPOINT_DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: false
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
  console.log('📊 Endpoint Database connected via ENDPOINT_DATABASE_URL');
} else {
  // Fallback: Use same database as primary if no separate endpoint database configured
  console.log('⚠️  ENDPOINT_DATABASE_URL not set, using PRIMARY database as fallback');
  
  const PRIMARY_DATABASE_URL = process.env.DATABASE_URL;
  
  if (PRIMARY_DATABASE_URL && PRIMARY_DATABASE_URL.trim() !== '') {
    endpointSequelize = new Sequelize(PRIMARY_DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: false
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });
    console.log('📊 Endpoint Database using PRIMARY database (fallback mode)');
  } else {
    // Use individual env vars
    const PGHOST = process.env.PGHOST;
    const PGPORT = process.env.PGPORT || 5432;
    const PGUSER = process.env.PGUSER || 'postgres';
    const PGDATABASE = process.env.PGDATABASE;
    const PGPASSWORD = process.env.PGPASSWORD || '';

    if (!PGHOST || !PGDATABASE) {
      throw new Error('Database configuration missing. Please set ENDPOINT_DATABASE_URL, DATABASE_URL, or PG* environment variables.');
    }

    endpointSequelize = new Sequelize(PGDATABASE, PGUSER, PGPASSWORD, {
      host: PGHOST,
      port: PGPORT,
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: false
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });

    console.log(`📊 Endpoint Database using PRIMARY database via PG* vars: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}`);
  }
}

export default endpointSequelize;
