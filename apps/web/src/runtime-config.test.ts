import { describe, expect, it, vi } from "vitest";

import { loadRuntimeConfig, parseRuntimeConfig } from "./runtime-config";

describe("parseRuntimeConfig", () => {
  it("accepts a same-origin production configuration", () => {
    expect(parseRuntimeConfig({ environment: "prod", apiBaseUrl: "" })).toEqual({
      environment: "prod",
      apiBaseUrl: "",
      auth: { enabled: false },
    });
  });

  it("normalizes a trailing slash", () => {
    expect(parseRuntimeConfig({ environment: "dev", apiBaseUrl: "https://gateway.dev.example.com/" })).toEqual({
      environment: "dev",
      apiBaseUrl: "https://gateway.dev.example.com",
      auth: { enabled: false },
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

  it("accepts and normalizes an enabled OIDC public client", () => {
    expect(
      parseRuntimeConfig({
        environment: "dev",
        apiBaseUrl: "",
        auth: {
          enabled: true,
          authority: "https://identity.dev.example.com/realms/template/",
          clientId: "template-spa",
        },
      }),
    ).toEqual({
      environment: "dev",
      apiBaseUrl: "",
      auth: {
        enabled: true,
        authority: "https://identity.dev.example.com/realms/template",
        clientId: "template-spa",
        scope: "openid profile email",
        callbackPath: "/oidc/callback",
        logoutCallbackPath: "/oidc/logout-callback",
        postLogoutPath: "/",
      },
    });
  });

  it("rejects an insecure OIDC authority in prod", () => {
    expect(() =>
      parseRuntimeConfig({
        environment: "prod",
        apiBaseUrl: "",
        auth: { enabled: true, authority: "http://identity.example.com/realms/template", clientId: "template-spa" },
      }),
    ).toThrow(/https/);
  });

  it("rejects a client secret even when authentication is disabled", () => {
    expect(() =>
      parseRuntimeConfig({
        environment: "local",
        apiBaseUrl: "",
        auth: { enabled: false, clientSecret: "never-store-this" },
      }),
    ).toThrow(/client secret/);
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

    await expect(loadRuntimeConfig(fetchImpl)).resolves.toEqual({
      environment: "local",
      apiBaseUrl: "",
      auth: { enabled: false },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/app-config.json",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
