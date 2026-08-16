const REQUIRED_METADATA = [
  'scenario',
  'gitSha',
  'testEnvironment',
  'instanceProfile',
  'datasetDescription',
  'baseUrl',
  'completedAt',
];

const REQUIRED_METRICS = [
  'http_reqs',
  'http_req_duration',
  'http_req_failed',
];

function objectValue(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}

function requiredText(value, name) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (!text) {
    throw new Error(`${name} is required`);
  }
  return text;
}

function optionalText(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  return text || '기록되지 않음';
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value, digits = 2) {
  const number = finiteNumber(value);
  if (number === null) {
    return 'N/A';
  }
  return number.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function formatPercent(value) {
  const number = finiteNumber(value);
  return number === null ? 'N/A' : `${formatNumber(number * 100, 3)}%`;
}

function markdownCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function metricValues(metrics, name, required = true) {
  const metric = metrics[name];
  if (!metric) {
    if (required) {
      throw new Error(`k6Summary.metrics.${name} is required`);
    }
    return {};
  }
  return objectValue(metric.values, `k6Summary.metrics.${name}.values`);
}

function thresholdRows(metrics) {
  return Object.entries(metrics)
    .flatMap(([metricName, metric]) => Object.entries(metric.thresholds || {})
      .map(([criterion, result]) => ({
        metricName,
        criterion,
        ok: result?.ok === true,
      })))
    .sort((left, right) => `${left.metricName}:${left.criterion}`
      .localeCompare(`${right.metricName}:${right.criterion}`));
}

export function validateSummary(summary) {
  const root = objectValue(summary, 'summary');
  const metadata = objectValue(root.metadata, 'metadata');
  const inputs = objectValue(root.inputs, 'inputs');
  const k6Summary = objectValue(root.k6Summary, 'k6Summary');
  const metrics = objectValue(k6Summary.metrics, 'k6Summary.metrics');

  for (const field of REQUIRED_METADATA) {
    requiredText(metadata[field], `metadata.${field}`);
  }
  for (const metricName of REQUIRED_METRICS) {
    metricValues(metrics, metricName);
  }

  return { root, metadata, inputs, k6Summary, metrics };
}

export function renderMarkdownReport(summary) {
  const { metadata, inputs, metrics } = validateSummary(summary);
  const requests = metricValues(metrics, 'http_reqs');
  const duration = metricValues(metrics, 'http_req_duration');
  const failed = metricValues(metrics, 'http_req_failed');
  const dropped = metricValues(metrics, 'dropped_iterations', false);
  const checks = metricValues(metrics, 'checks', false);
  const thresholds = thresholdRows(metrics);
  const contractStatus = thresholds.length === 0
    ? 'NOT_EVALUATED'
    : thresholds.every((threshold) => threshold.ok) ? 'PASS' : 'FAIL';

  const thresholdTable = thresholds.length === 0
    ? '| 없음 | 없음 | NOT_EVALUATED |'
    : thresholds.map((threshold) => (
      `| ${markdownCell(threshold.metricName)} | ${markdownCell(threshold.criterion)} | ${threshold.ok ? 'PASS' : 'FAIL'} |`
    )).join('\n');

  return [
    `# 부하 테스트 결과: ${markdownCell(metadata.scenario)}`,
    '',
    '> 이 문서는 한 번의 측정 결과와 입력 조건을 기록한다. PASS는 이 실행에 설정된 threshold를 만족했다는 뜻이며 처리량·가용성 보장이 아니다.',
    '',
    '## 실행 메타데이터',
    '',
    '| 항목 | 값 |',
    '|---|---|',
    `| Git SHA | \`${markdownCell(metadata.gitSha)}\` |`,
    `| 완료 시각 | ${markdownCell(metadata.completedAt)} |`,
    `| 환경 | ${markdownCell(metadata.testEnvironment)} |`,
    `| 대상 URL | ${markdownCell(metadata.baseUrl)} |`,
    `| 인스턴스 사양 | ${markdownCell(metadata.instanceProfile)} |`,
    `| 데이터셋 | ${markdownCell(metadata.datasetDescription)} |`,
    `| 이미지 digest | ${markdownCell(optionalText(metadata.imageDigest))} |`,
    `| 의존성 구성 | ${markdownCell(optionalText(metadata.dependencyProfile))} |`,
    '',
    '## 실행 계약 판정',
    '',
    `**${contractStatus}**`,
    '',
    '| Metric | Threshold | 결과 |',
    '|---|---|---|',
    thresholdTable,
    '',
    '## 핵심 측정값',
    '',
    '| 지표 | 측정값 |',
    '|---|---:|',
    `| 요청 수 | ${formatNumber(requests.count, 0)} |`,
    `| 요청 처리율 | ${formatNumber(requests.rate)} req/s |`,
    `| 오류율 | ${formatPercent(failed.rate)} |`,
    `| p50 | ${formatNumber(duration.med)} ms |`,
    `| p95 | ${formatNumber(duration['p(95)'])} ms |`,
    `| p99 | ${formatNumber(duration['p(99)'])} ms |`,
    `| 최대 지연 | ${formatNumber(duration.max)} ms |`,
    `| Dropped iterations | ${formatNumber(dropped.count, 0)} |`,
    `| Check 성공률 | ${formatPercent(checks.rate)} |`,
    '',
    '## 시나리오 입력',
    '',
    '```json',
    JSON.stringify(inputs, null, 2),
    '```',
    '',
    '## 해석 체크리스트',
    '',
    '- 같은 시간대의 Prometheus/Grafana에서 CPU, JVM heap, GC, DB pool 포화를 함께 확인한다.',
    '- 데이터 크기, 인스턴스 수나 의존성 구성이 다르면 별도 기준선으로 관리한다.',
    '- knee point 후보는 최초 SLO 이탈 또는 지속 포화 단계의 직전 단계에서 검토한다.',
    '- 실제 등급 승격에는 반복 실행, 장애 주입과 복구 시간 검증이 추가로 필요하다.',
    '',
  ].join('\n');
}
