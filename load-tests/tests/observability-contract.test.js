import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function repositoryFile(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

test('dashboard contains the service saturation signals used during load tests', async () => {
  const dashboard = JSON.parse(await repositoryFile(
    'infra/observability/grafana/dashboards/service-capacity.json',
  ));
  const expressions = dashboard.panels
    .flatMap((panel) => panel.targets || [])
    .map((target) => target.expr || '')
    .join('\n');

  assert.equal(dashboard.uid, 'mpt-service-capacity');
  assert.match(expressions, /http_server_requests_seconds_count/);
  assert.match(expressions, /http_server_requests_seconds_bucket/);
  assert.match(expressions, /process_cpu_usage/);
  assert.match(expressions, /jvm_memory_used_bytes/);
  assert.match(expressions, /hikaricp_connections_pending/);
});

test('observability profile is optional, localhost-bound, and selected by generators', async () => {
  const [
    compose,
    versions,
    prometheus,
    applyConfig,
    configurator,
    gatewayConfig,
    sampleConfig,
  ] = await Promise.all([
    repositoryFile('infra/compose.yml'),
    repositoryFile('infra/.env.versions'),
    repositoryFile('infra/observability/prometheus.yml'),
    repositoryFile('tools/apply-config.ps1'),
    repositoryFile('tools/configurator/app/Configurator.tsx'),
    repositoryFile('services/gateway-service/src/main/resources/application.yml'),
    repositoryFile('services/sample-service/src/main/resources/application.yml'),
  ]);

  assert.match(compose, /profiles: \[observability\]/);
  assert.match(compose, /127\.0\.0\.1:\$\{PROMETHEUS_PORT:-9090\}:9090/);
  assert.match(compose, /127\.0\.0\.1:\$\{GRAFANA_PORT:-3001\}:3000/);
  assert.match(versions, /^PROMETHEUS_IMAGE=prom\/prometheus:v\d+\.\d+\.\d+$/m);
  assert.match(versions, /^GRAFANA_IMAGE=grafana\/grafana:\d+\.\d+\.\d+$/m);
  assert.match(prometheus, /metrics_path: \/actuator\/prometheus/);
  assert.match(prometheus, /host\.docker\.internal:8080/);
  assert.match(prometheus, /host\.docker\.internal:8081/);
  assert.match(applyConfig, /features\.observability.+profiles \+= 'observability'/);
  assert.match(configurator, /features\.observability \? "observability"/);
  assert.match(gatewayConfig, /percentiles-histogram:\s+http\.server\.requests: true/);
  assert.match(sampleConfig, /percentiles-histogram:\s+http\.server\.requests: true/);
});

test('capacity HA profile is local-only and retries a second sample-service instance', async () => {
  const [compose, versions, exampleEnvironment, proxy] = await Promise.all([
    repositoryFile('infra/compose.yml'),
    repositoryFile('infra/.env.versions'),
    repositoryFile('infra/.env.example'),
    repositoryFile('infra/capacity/nginx.conf'),
  ]);

  assert.match(compose, /profiles: \[capacity-ha\]/);
  assert.match(compose, /127\.0\.0\.1:\$\{CAPACITY_PROXY_PORT:-8084\}:8080/);
  assert.match(versions, /^CAPACITY_PROXY_IMAGE=nginx:\d+\.\d+\.\d+-alpine\d+\.\d+$/m);
  assert.match(exampleEnvironment, /^CAPACITY_PROXY_PORT=8084$/m);
  assert.match(proxy, /host\.docker\.internal:8081/);
  assert.match(proxy, /host\.docker\.internal:8083/);
  assert.match(proxy, /proxy_next_upstream error timeout http_502 http_503 http_504/);
  assert.match(proxy, /proxy_next_upstream_tries 2/);
});
