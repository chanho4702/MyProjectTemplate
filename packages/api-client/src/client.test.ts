import { describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient } from "./client";

const ITEM = {
  id: "d55ad19c-d38d-4d10-90b3-c236fd360c42",
  name: "first-item",
  createdAt: "2026-08-16T00:00:00Z",
};

describe("createApiClient", () => {
  it("calls the Gateway item endpoint with a safe request id", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([ITEM]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createApiClient({
      baseUrl: "https://gateway.example.test/",
      fetchImpl,
      requestIdFactory: () => "web-test-request-0001",
    });

    await expect(client.listItems()).resolves.toEqual([ITEM]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://gateway.example.test/api/v1/items",
      expect.objectContaining({
        headers: { Accept: "application/json", "X-Request-Id": "web-test-request-0001" },
      }),
    );
  });

  it("sends an item as JSON", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(ITEM), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createApiClient({ fetchImpl, requestIdFactory: () => "web-test-request-0002" });

    await expect(client.createItem("first-item")).resolves.toEqual(ITEM);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/items",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "first-item" }) }),
    );
  });

  it("adds an OIDC bearer token only when a provider returns one", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([ITEM]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const accessTokenProvider = vi.fn().mockResolvedValue("access-token-0001");
    const client = createApiClient({ fetchImpl, accessTokenProvider });

    await client.listItems();

    expect(accessTokenProvider).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/items",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer access-token-0001" }),
      }),
    );
  });

  it("maps Problem Detail and validation violations to ApiError", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          title: "Bad Request",
          detail: "The request contains invalid values.",
          code: "VALIDATION_FAILED",
          requestId: "backend-request-0001",
          violations: [{ field: "name", message: "must not be blank" }],
        }),
        { status: 400, headers: { "content-type": "application/problem+json" } },
      ),
    );
    const client = createApiClient({ fetchImpl, requestIdFactory: () => "web-test-request-0003" });

    const error = await client.createItem("").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
      requestId: "backend-request-0001",
      violations: [{ field: "name", message: "must not be blank" }],
    });
  });

  it("falls back to the response request id for a non-JSON failure", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("upstream unavailable", {
        status: 503,
        headers: { "content-type": "text/plain", "x-request-id": "gateway-request-0001" },
      }),
    );
    const client = createApiClient({ fetchImpl, requestIdFactory: () => "web-test-request-0004" });

    await expect(client.listItems()).rejects.toMatchObject({
      status: 503,
      requestId: "gateway-request-0001",
    });
  });
});
