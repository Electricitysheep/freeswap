#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig } from '../config';
import { createProxyServer } from '../proxy/server';

const program = new Command();

program
  .name('freeswap')
  .description('🔄 FreeSwap - Hot-swap free LLM models for your agents')
  .version('0.1.0');

program
  .command('start')
  .description('Start the FreeSwap proxy server')
  .option('-p, --port <number>', 'Port to listen on')
  .option('-h, --host <address>', 'Host to bind to')
  .option('-k, --key <key>', 'Master API key')
  .action(async (options) => {
    const config = loadConfig();

    if (options.port) config.port = parseInt(options.port, 10);
    if (options.host) config.host = options.host;
    if (options.key) config.masterKey = options.key;

    const app = await createProxyServer(config);

    app.listen(config.port, config.host, () => {
      const enabled = config.providers.filter((p) => p.enabled).map((p) => p.id);
      console.log(`\n  🔄 FreeSwap v0.1.0`);
      console.log(`  ─────────────────────────────`);
      console.log(`  Proxy:  http://${config.host}:${config.port}/v1`);
      console.log(`  Models: http://${config.host}:${config.port}/v1/models`);
      console.log(`  Status: http://${config.host}:${config.port}/v1/status`);
      console.log(`  ─────────────────────────────`);
      console.log(`  Enabled providers: ${enabled.join(', ')}`);
      console.log(`  Meta-models: free, free-fast, free-smart`);
      console.log(`  ─────────────────────────────`);
      console.log(`  Replace your OpenAI base URL with:`);
      console.log(`  http://${config.host}:${config.port}/v1\n`);
    });
  });

program
  .command('list')
  .description('List all registered free models')
  .action(async () => {
    const config = loadConfig();
    const { loadRegistry } = require('../registry');
    const registry = await loadRegistry(config.registryPath);
    console.log(`\n  FreeSwap Registry (${registry.models.length} models)\n`);
    for (const m of registry.models) {
      const status = m.status === 'active' ? '✓' : '✗';
      console.log(`  ${status} ${m.id.padEnd(40)} ${m.name}`);
    }
    console.log('');
  });

program
  .command('providers')
  .description('List configured providers')
  .action(() => {
    const config = loadConfig();
    console.log('\n  Configured Providers\n');
    for (const p of config.providers) {
      const status = p.enabled ? '✓' : '✗';
      const keyCount = p.apiKeys.length;
      console.log(`  ${status} ${p.id.padEnd(20)} ${keyCount} key(s)`);
    }
    console.log('');
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
