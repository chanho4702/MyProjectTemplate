import assert from 'node:assert/strict';
import { mkdir, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderMarkdownReport, validateSummary } from '../lib/report.js';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

function summary(overrides = {}) {
  return {
    metadata: {
      scenario: 'spike',
      gitSha: '0123456789abcdef0123456789abcdef01234567',
      imageDigest: 'sha256:abc123',
      testEnvironment: 'local',
      instanceProfile: '1 app, 2 vCPU, 2 GiB heap',
      datasetDescription: '10,000 items, read-only request mix',
      dependencyProfile: 'PostgreSQL writer only',
      baseUrl: 'http://localhost:8081',
      completedAt: '2026-08-16T01:00:00.000Z',
    },
    inputs: {
      baselineTps: 20,
      spikeTps: 60,
      thresholds: {
        maxErrorRate: 0.001,
        p95Milliseconds: 300,
        p99Milliseconds: 800,
      },
    },
    k6Summary: {
      metrics: {
        http_reqs: {
          values: { count: 1200, rate: 39.99 },
        },
        http_req_duration: {
          values: { med: 42.5, 'p(95)': 210.1, 'p(99)': 430.2, max: 701.4 },
          thresholds: {
            'p(95)<300': { ok: true },
            'p(99)<800': { ok: true },
          },
        },
        http_req_failed: {
          values: { rate: 0.0005 },
          thresholds: { 'rate<0.001': { ok: true } },
        },
        dropped_iterations: {
          values: { count: 0 },
          thresholds: { 'count==0': { ok: true } },
        },
        checks: {
          values: { rate: 0.9995 },
        },
      },
    },
    ...overrides,
  };
}

test('renders metadata, key metrics, thresholds, and interpretation guardrails', () => {
  const report = renderMarkdownReport(summary());

  assert.match(report, /# 부하 테스트 결과: spike/);
  assert.match(report, /\*\*PASS\*\*/);
  assert.match(report, /39\.99 req\/s/);
  assert.match(report, /0\.05%/);
  assert.match(report, /210\.1 ms/);
  assert.match(report, /처리량·가용성 보장이 아니다/);
});

test('reports FAIL when any configured threshold fails', () => {
  const failedSummary = summary();
  failedSummary.k6Summary.metrics.http_req_failed.thresholds['rate<0.001'].ok = false;

  const report = renderMarkdownReport(failedSummary);
  assert.match(report, /\*\*FAIL\*\*/);
  assert.match(report, /\| http_req_failed \| rate<0\.001 \| FAIL \|/);
});

test('rejects missing required metadata and metrics', () => {
  const missingMetadata = summary();
  delete missingMetadata.metadata.gitSha;
  assert.throws(() => validateSummary(missingMetadata), /metadata\.gitSha is required/);

  const missingMetric = summary();
  delete missingMetric.k6Summary.metrics.http_req_duration;
  assert.throws(() => validateSummary(missingMetric), /http_req_duration is required/);
});

test('CLI writes a Markdown report below load-tests/results', async () => {
  const directoryName = `report-contract-${process.pid}-${Date.now()}`;
  const relativeDirectory = `load-tests/results/${directoryName}`;
  const absoluteDirectory = join(repositoryRoot, relativeDirectory);
  const inputPath = join(absoluteDirectory, 'summary.json');
  const outputPath = join(absoluteDirectory, 'report.md');

  await mkdir(absoluteDirectory, { recursive: true });
  try {
    await writeFile(inputPath, JSON.stringify(summary()), 'utf8');
    const result = spawnSync(process.execPath, [
      'load-tests/report.js',
      '--input', `${relativeDirectory}/summary.json`,
      '--output', `${relativeDirectory}/report.md`,
    ], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Created load-tests[\\/]results/);
    assert.match(await readFile(outputPath, 'utf8'), /# 부하 테스트 결과: spike/);
  } finally {
    await Promise.allSettled([unlink(inputPath), unlink(outputPath)]);
    await rmdir(absoluteDirectory);
  }
});
