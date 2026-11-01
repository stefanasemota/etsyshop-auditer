#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { EtsyClient } from '../src/api/etsy-client.mjs';
import { auditShopCatalog } from '../src/audit/rubric.mjs';
import { generateCatalogPatches } from '../src/optimizer/patch-engine.mjs';
import { createDashboardServer } from '../src/server/dashboard.mjs';

const __filename = fileURLToPath(import.meta.url);

export function runCli(argv = process.argv.slice(2)) {
  const command = argv[0] || 'audit';
  const strategyFlag = argv.find((a) => a.startsWith('--strategy='));
  const strategy = strategyFlag ? strategyFlag.split('=')[1] : 'pragmatic-balance';
  const client = new EtsyClient();

  if (command === 'audit') {
    const { source, data } = client.loadShopData();
    const report = auditShopCatalog(data);
    return { command, source, report };
  }

  if (command === 'optimize' || command === 'patch') {
    const { source, data } = client.loadShopData();
    const patches = generateCatalogPatches(data, { strategy });
    return { command, source, strategy, patches };
  }

  if (command === 'stage-all') {
    const { data } = client.loadShopData();
    const patches = generateCatalogPatches(data, { strategy });
    const staged = patches.map((p) => client.stageListingPatch(p));
    return { command, strategy, stagedCount: staged.length, staged };
  }

  if (command === 'serve') {
    const port = Number(process.env.PORT || 4321);
    const server = createDashboardServer({ client, defaultStrategy: strategy });
    server.listen(port, () => {
      console.log(`🛍️ etsyshop-auditer Preview Diff Dashboard running at http://localhost:${port}`);
    });
    return { command, port, server };
  }

  throw new Error(`Unknown command "${command}". Supported: audit | optimize | stage-all | serve`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const result = runCli();
  if (result.command !== 'serve') {
    console.log(JSON.stringify(result, null, 2));
  }
}
