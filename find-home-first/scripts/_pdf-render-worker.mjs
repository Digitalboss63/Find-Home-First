/**
 * PDF render worker — runs in a child process so the parent can kill it if it hangs.
 * Outputs JSON result to stdout then exits.
 */
import { ATLANTA_FIXTURE } from '../src/lib/__tests__/fixtures/atlas-market-report.ts';
import { buildReportDocument } from '../src/lib/export/pdf-document.tsx';
import { renderToBuffer } from '@react-pdf/renderer';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(__dirname, 'output'), { recursive: true });

const t0 = Date.now();
try {
  const doc = buildReportDocument({
    report: ATLANTA_FIXTURE,
    exportedAt: new Date().toISOString(),
  });
  const buf = await renderToBuffer(doc);
  const elapsed = Date.now() - t0;
  const text = buf.toString('latin1');
  const forbidden = ['API_KEY', 'DATABASE_URL', 'CLERK_SECRET', 'sk_live_', 'sk_test_'];
  const credHit = forbidden.find((k) => text.includes(k)) ?? null;
  const outPath = join(__dirname, 'output', 'test-pdf-render.pdf');
  writeFileSync(outPath, buf);
  process.stdout.write(JSON.stringify({
    ok: true,
    elapsedMs: elapsed,
    byteLength: buf.length,
    magic: buf.slice(0, 4).toString(),
    credentialHit: credHit,
    outPath,
  }) + '\n');
  process.exit(0);
} catch (e) {
  process.stdout.write(JSON.stringify({ ok: false, error: String(e) }) + '\n');
  process.exit(1);
}
