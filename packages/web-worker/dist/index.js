import { defineWebWorkers } from './pure.js';
import 'vitest/execute';
import 'debug';
import 'node:worker_threads';

defineWebWorkers();
