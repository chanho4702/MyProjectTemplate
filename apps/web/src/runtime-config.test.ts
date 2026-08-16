import { describe, expect, it, vi } from "vitest";

import { loadRuntimeConfig, parseRuntimeConfig } from "./runtime-config";

describe("parseRuntimeConfig", () => {
  it("accepts a same-origin production configuration", () => {
    expect(parseRuntimeConfig({ environment: "prod", apiBaseUrl: "" })).toEqual({
      environment: "prod",
      apiBaseUrl: "",
    });
  });

  it("normalizes a trailing slash", () => {
    expect(parseRuntimeConfig({ environment: "dev", apiBaseUrl: "https://gateway.dev.example.com/" })).toEqual({
      environment: "dev",
      apiBaseUrl: "https://gateway.dev.example.com",
    });
  });

  it("rejects localhost in prod", () => {
    expect(() => parseRuntimeConfig({ environment: "prod", apiBaseUrl: "http://localhost:8080" })).toThrow(
      /prod apiBaseUrl/,
    );
  });

  it("rejects an insecure external URL in prod", () => {
    expect(() => parseRuntimeConfig({ environment: "prod", apiBaseUrl: "http://gateway.example.com" })).toThrow(
      /https/,
    );
  });

  it("rejects credentials in a URL", () => {
    expect(() => parseRuntimeConfig({ environment: "dev", apiBaseUrl: "https://user:secret@example.com" })).toThrow(
      /비밀번호/,
    );
  });
});

describe("loadRuntimeConfig", () => {
  it("loads the configuration without browser caching", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ environment: "local", apiBaseUrl: "" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(loadRuntimeConfig(fetchImpl)).resolves.toEqual({ environment: "local", apiBaseUrl: "" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/app-config.json",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
