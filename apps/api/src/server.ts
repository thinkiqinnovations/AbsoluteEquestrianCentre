import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { app } from './app.js';
import { database } from './database.js';

const port = Number(process.env.PORT ?? 3001);
const webBuild = resolve(process.cwd(), 'apps', 'web', 'dist');
if (existsSync(webBuild)) {
  app.use(express.static(webBuild));
  app.get('*', (_req, res) => res.sendFile(resolve(webBuild, 'index.html')));
}

const server = app.listen(port, () => console.log(`Absolute Equestrian listening on http://localhost:${port} (${database.mode})`));
const shutdown = () => server.close(() => { void database.disconnect().finally(() => process.exit(0)); });
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
