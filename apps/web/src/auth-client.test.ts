import { describe, expect, it, vi } from "vitest";

import { createAuthClient } from "./auth-client";
import type { AuthRuntimeConfig } from "./runtime-config";

const ENABLED_CONFIG: AuthRuntimeConfig = {
  enabled: true,
  authority: "http://localhost:8180/realms/template",
  clientId: "template-spa",
  scope: "openid profile email",
  callbackPath: "/oidc/callback",
  logoutCallbackPath: "/oidc/logout-callback",
  postLogoutPath: "/",
};

const BROWSER = {
  origin: "http://localhost:5173",
  pathname: "/",
  search: "",
  replaceUrl: vi.fn(),
};

function createManager(user: { access_token: string; expired?: boolean; profile: Record<string, unknown> } | null) {
  return {
    events: {
      addUserLoaded: vi.fn(),
      addUserUnloaded: vi.fn(),
      addSilentRenewError: vi.fn(),
    },
    getUser: vi.fn().mockResolvedValue(user),
    signinRedirect: vi.fn().mockResolvedValue(undefined),
    signinRedirectCallback: vi.fn(),
    signinSilent: vi.fn(),
    signoutRedirect: vi.fn().mockResolvedValue(undefined),
    signoutRedirectCallback: vi.fn().mockResolvedValue(undefined),
    removeUser: vi.fn().mockResolvedValue(undefined),
  };
}

describe("createAuthClient", () => {
  it("does not load the OIDC implementation when authentication is disabled", async () => {
    const managerFactory = vi.fn();

    const client = await createAuthClient({ enabled: false }, { managerFactory, browser: BROWSER });

    expect(client.getSnapshot()).toEqual({ status: "disabled" });
    await expect(client.getAccessToken()).resolves.toBeUndefined();
    expect(managerFactory).not.toHaveBeenCalled();
  });

  it("keeps anonymous users on the page and starts login only on request", async () => {
    const manager = createManager(null);
    const managerFactory = vi.fn().mockResolvedValue(manager);

    const client = await createAuthClient(ENABLED_CONFIG, { managerFactory, browser: BROWSER });

    expect(client.getSnapshot()).toEqual({ status: "anonymous" });
    expect(managerFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        redirect_uri: "http://localhost:5173/oidc/callback",
        post_logout_redirect_uri: "http://localhost:5173/oidc/logout-callback",
        response_type: "code",
        automaticSilentRenew: true,
      }),
    );
    await client.login();
    expect(manager.signinRedirect).toHaveBeenCalledOnce();
  });

  it("finishes the logout callback and clears the local session view", async () => {
    const manager = createManager({ access_token: "old-token", profile: { name: "Old User" } });
    const replaceUrl = vi.fn();

    const client = await createAuthClient(ENABLED_CONFIG, {
      managerFactory: vi.fn().mockResolvedValue(manager),
      browser: {
        origin: "http://localhost:5173",
        pathname: "/oidc/logout-callback",
        search: "?state=logout-state",
        replaceUrl,
      },
    });

    expect(manager.signoutRedirectCallback).toHaveBeenCalledOnce();
    expect(replaceUrl).toHaveBeenCalledWith("/");
    expect(client.getSnapshot()).toEqual({ status: "anonymous" });
    await expect(client.getAccessToken()).resolves.toBeUndefined();
  });

  it("finishes the redirect callback and exposes the access token", async () => {
    const user = { access_token: "access-token-0001", profile: { preferred_username: "local-user" } };
    const manager = createManager(null);
    manager.signinRedirectCallback.mockResolvedValue(user);
    const replaceUrl = vi.fn();

    const client = await createAuthClient(ENABLED_CONFIG, {
      managerFactory: vi.fn().mockResolvedValue(manager),
      browser: {
        origin: "http://localhost:5173",
        pathname: "/oidc/callback",
        search: "?code=authorization-code&state=opaque-state",
        replaceUrl,
      },
    });

    expect(manager.signinRedirectCallback).toHaveBeenCalledOnce();
    expect(replaceUrl).toHaveBeenCalledWith("/");
    expect(client.getSnapshot()).toEqual({ status: "authenticated", displayName: "local-user" });
    await expect(client.getAccessToken()).resolves.toBe("access-token-0001");
  });

  it("renews an expired token before returning it", async () => {
    const manager = createManager({ access_token: "expired", expired: true, profile: {} });
    manager.signinSilent.mockResolvedValue({
      access_token: "renewed-token",
      expired: false,
      profile: { name: "Renewed User" },
    });
    const client = await createAuthClient(ENABLED_CONFIG, {
      managerFactory: vi.fn().mockResolvedValue(manager),
      browser: BROWSER,
    });

    await expect(client.getAccessToken()).resolves.toBe("renewed-token");
    expect(manager.signinSilent).toHaveBeenCalledOnce();
    expect(client.getSnapshot()).toEqual({ status: "authenticated", displayName: "Renewed User" });
  });
});
