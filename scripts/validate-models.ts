import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

const REGISTRY_PATH = join(__dirname, '../models/registry.yaml');

interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  apiModelName: string;
  rateLimit: { rpm: number; rpd: number; tpm: number; tpd: number };
  capabilities: {
    toolUse: boolean; structuredOutput: boolean; vision: boolean; streaming: boolean;
    maxContext: number; maxOutput: number;
  };
  status: string;
  avgLatencyMs?: number;
}

async function validate() {
  const raw = readFileSync(REGISTRY_PATH, 'utf-8');
  const data = yaml.load(raw) as any;

  if (!data || !Array.isArray(data.models)) {
    console.error('ERROR: Invalid registry format — missing models array');
    process.exit(1);
  }

  const errors: string[] = [];
  const ids = new Set<string>();

  for (let i = 0; i < data.models.length; i++) {
    const m = data.models[i];
    if (!m.id) errors.push(`models[${i}]: missing "id"`);
    if (ids.has(m.id)) errors.push(`models[${i}]: duplicate id "${m.id}"`);
    ids.add(m.id);
    if (!m.provider) errors.push(`models[${i}] (${m.id}): missing "provider"`);
    if (!m.apiModelName) errors.push(`models[${i}] (${m.id}): missing "apiModelName"`);
    if (m.rateLimit) {
      const rl = m.rateLimit;
      if (typeof rl.rpm !== 'number') errors.push(`models[${i}] (${m.id}): rateLimit.rpm must be a number`);
      if (typeof rl.rpd !== 'number') errors.push(`models[${i}] (${m.id}): rateLimit.rpd must be a number`);
    }
  }

  if (errors.length > 0) {
    console.error(`\n  Registry validation FAILED (${errors.length} errors):\n`);
    for (const err of errors) console.error(`  ✗ ${err}`);
    process.exit(1);
  }

  console.log(`\n  ✓ Registry valid — ${data.models.length} models, ${data.metaModels ? Object.keys(data.metaModels).length : 0} meta-models\n`);
}

validate().catch(console.error);
