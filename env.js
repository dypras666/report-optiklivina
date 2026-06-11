import dotenv from 'dotenv';
import path from 'path';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config(); // Fallback to .env

console.log(`[Env] Loaded environment from ${envFile}`);
