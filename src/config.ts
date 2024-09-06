import dotenv from 'dotenv';

// Determine the environment
const env = process.env.NODE_ENV || 'development';

// Load environment variables from .env file
dotenv.config({ path: `.env.${env}` });

const config = {
  port: process.env.ORDERBOOK_PORT || 5000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ordersDB',
  batchInterval: 10000,
};

export default config;
