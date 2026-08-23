/** Register/refresh collectors table from env. Usage: npm run collectors:register */
import 'dotenv/config';
import { registerCollectors } from '../collector-registry.js';

registerCollectors();
