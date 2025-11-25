import dotenv from 'dotenv';
import app from './src/app.js';

dotenv.config();

const port = parseInt(process.env.PORT || '4000', 10);

// Start the server
const server = app.listen(port, () => {
  console.log(`Report backend listening on http://localhost:${port}`);
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