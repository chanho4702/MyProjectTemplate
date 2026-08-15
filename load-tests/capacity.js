import http from 'k6/http';
import { check } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:8081';
const targetTps = Number(__ENV.TARGET_TPS || 100);
const duration = __ENV.DURATION || '5m';

export const options = {
  scenarios: {
    read_capacity: {
      executor: 'constant-arrival-rate',
      rate: targetTps,
      timeUnit: '1s',
      duration,
      preAllocatedVUs: Math.max(10, Math.ceil(targetTps / 4)),
      maxVUs: Math.max(50, targetTps * 2),
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.001'],
    http_req_duration: ['p(95)<300', 'p(99)<800'],
    dropped_iterations: ['count==0'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/api/v1/items`);
  check(response, { 'status is 200': (result) => result.status === 200 });
}
