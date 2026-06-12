import './env.js';
import path from 'path';
import cron from 'node-cron';
import { runDeltaSync } from './src/services/esSyncCron.js';
import { runProductsSync } from './src/services/esSyncProducts.js';
import { runTokoSync } from './src/services/esSyncToko.js';

import app from './src/app.js';

const port = parseInt(process.env.PORT || '4000', 10);
const host = process.env.HOST || '0.0.0.0';

// Start the server
const server = app.listen(port, host, () => {
  console.log(`Report backend listening on http://${host}:${port}`);
  
  // Start the ES Delta Sync Cron Job (runs every 1 minute)
  console.log('[Server] Starting Elasticsearch Delta Sync Cron Job...');
  cron.schedule('*/1 * * * *', () => {
    runDeltaSync();
  });

  // Start the ES Products Sync Cron Job (runs every 5 minutes)
  console.log('[Server] Starting Elasticsearch Products Sync Cron Job...');
  cron.schedule('*/5 * * * *', () => {
    runProductsSync();
  });

  // Start the ES Toko Sync Cron Job (runs every 5 minutes)
  console.log('[Server] Starting Elasticsearch Toko Sync Cron Job...');
  cron.schedule('*/5 * * * *', () => {
    runTokoSync();
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('[Server] Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('[Server] Process terminated');
    process.exit(0);
  });
});