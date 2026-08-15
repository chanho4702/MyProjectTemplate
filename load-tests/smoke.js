import http from 'k6/http';
import { check } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:8081';

export const options = {
  vus: 1,
  iterations: 5,
  thresholds: {
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/api/v1/items`, {
    headers: { 'X-Request-Id': `k6-smoke-${__VU}-${__ITER}` },
  });
  check(response, {
    'status is 200': (result) => result.status === 200,
    'request id is returned': (result) => Boolean(result.headers['X-Request-Id']),
  });
}
