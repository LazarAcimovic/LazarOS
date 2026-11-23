import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { setupServer } from "msw/node";

// MSW node server. No default handlers yet: the existing suites still mock at the api/ layer
// (vi.mock), so unhandled requests are passed through rather than failed. R06.3/R06.4 move this
// to src/test/ and switch to onUnhandledRequest: "error" with default handlers.
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
