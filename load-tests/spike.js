import http from 'k6/http';
import { check } from 'k6';
import { createSpikePlan, createSummaryArtifacts } from './lib/scenario-config.js';

const plan = createSpikePlan(__ENV);

export const options = plan.options;

export default function () {
  const response = http.get(`${plan.context.baseUrl}/api/v1/items`, {
    headers: { 'X-Request-Id': `k6-spike-${__VU}-${__ITER}` },
  });
  check(response, { 'status is 200': (result) => result.status === 200 });
}

export function handleSummary(data) {
  return createSummaryArtifacts(data, plan);
}
