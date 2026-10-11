// MSW fake API server for client tests. Starts with no handlers; tests add
// the responses they need via server.use(...). Crash reports to
// /errors/client are accepted by default so tests that trigger one don't
// fail on an unhandled request — inspect them with `reportedErrors`.
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const reportedErrors = [];

export const server = setupServer(
  http.post('*/errors/client', async ({ request }) => {
    reportedErrors.push(await request.json());
    return new HttpResponse(null, { status: 204 });
  }),
);

export { http, HttpResponse };
