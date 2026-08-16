import type { AuthRuntimeConfig } from "./runtime-config";

export type AuthSnapshot =
  | { status: "disabled" }
  | { status: "anonymous" }
  | { status: "authenticated"; displayName: string }
  | { status: "error"; message: string };

export interface AuthClient {
  getSnapshot(): AuthSnapshot;
  subscribe(listener: () => void): () => void;
  login(): Promise<void>;
  logout(): Promise<void>;
  getAccessToken(): Promise<string | undefined>;
}

interface OidcUser {
  access_token: string;
  expired?: boolean;
  profile: Record<string, unknown>;
}

interface OidcManagerEvents {
  addUserLoaded(listener: (user: OidcUser) => void): void;
  addUserUnloaded(listener: () => void): void;
  addSilentRenewError(listener: (error: Error) => void): void;
}

interface OidcManager {
  events: OidcManagerEvents;
  getUser(): Promise<OidcUser | null>;
  signinRedirect(): Promise<void>;
  signinRedirectCallback(): Promise<OidcUser>;
  signinSilent(): Promise<OidcUser | null>;
  signoutRedirect(): Promise<void>;
  signoutRedirectCallback(): Promise<unknown>;
  removeUser(): Promise<void>;
}

interface OidcManagerSettings {
  authority: string;
  client_id: string;
  redirect_uri: string;
  post_logout_redirect_uri: string;
  response_type: "code";
  scope: string;
  automaticSilentRenew: boolean;
  loadUserInfo: boolean;
}

interface BrowserFacade {
  origin: string;
  pathname: string;
  search: string;
  replaceUrl(path: string): void;
}

export interface AuthClientDependencies {
  managerFactory?: (settings: OidcManagerSettings) => Promise<OidcManager>;
  browser?: BrowserFacade;
}

const DISABLED_SNAPSHOT: AuthSnapshot = { status: "disabled" };

function createDisabledAuthClient(): AuthClient {
  return {
    getSnapshot: () => DISABLED_SNAPSHOT,
    subscribe: () => () => undefined,
    login: async () => undefined,
    logout: async () => undefined,
    getAccessToken: async () => undefined,
  };
}

function getBrowser(): BrowserFacade {
  return {
    origin: window.location.origin,
    pathname: window.location.pathname,
    search: window.location.search,
    replaceUrl: (path) => window.history.replaceState(window.history.state, "", path),
  };
}

async function defaultManagerFactory(settings: OidcManagerSettings): Promise<OidcManager> {
  const { UserManager, WebStorageStateStore } = await import("oidc-client-ts");
  const stateStore = new WebStorageStateStore({ store: window.sessionStorage, prefix: "oidc.state." });
  const userStore = new WebStorageStateStore({ store: window.sessionStorage, prefix: "oidc.user." });
  return new UserManager({ ...settings, stateStore, userStore });
}

function readProfileString(profile: Record<string, unknown>, name: string): string | undefined {
  const value = profile[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function displayName(user: OidcUser): string {
  return (
    readProfileString(user.profile, "preferred_username") ??
    readProfileString(user.profile, "name") ??
    readProfileString(user.profile, "email") ??
    readProfileString(user.profile, "sub") ??
    "로그인 사용자"
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message;
  return "OIDC 인증 처리 중 알 수 없는 오류가 발생했습니다.";
}

function isOidcCallback(browser: BrowserFacade, callbackPath: string): boolean {
  if (browser.pathname !== callbackPath) return false;
  const parameters = new URLSearchParams(browser.search);
  return parameters.has("state") && (parameters.has("code") || parameters.has("error"));
}

function isLogoutCallback(browser: BrowserFacade, logoutCallbackPath: string): boolean {
  if (browser.pathname !== logoutCallbackPath) return false;
  return new URLSearchParams(browser.search).has("state");
}

export async function createAuthClient(
  config: AuthRuntimeConfig,
  dependencies: AuthClientDependencies = {},
): Promise<AuthClient> {
  if (!config.enabled) return createDisabledAuthClient();

  const browser = dependencies.browser ?? getBrowser();
  const managerFactory = dependencies.managerFactory ?? defaultManagerFactory;
  const manager = await managerFactory({
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: `${browser.origin}${config.callbackPath}`,
    post_logout_redirect_uri: `${browser.origin}${config.logoutCallbackPath}`,
    response_type: "code",
    scope: config.scope,
    automaticSilentRenew: true,
    loadUserInfo: false,
  });

  let currentUser: OidcUser | undefined;
  let snapshot: AuthSnapshot = { status: "anonymous" };
  const listeners = new Set<() => void>();

  const publish = (nextSnapshot: AuthSnapshot) => {
    snapshot = nextSnapshot;
    listeners.forEach((listener) => listener());
  };
  const applyUser = (user: OidcUser | null | undefined) => {
    currentUser = user ?? undefined;
    publish(user && !user.expired ? { status: "authenticated", displayName: displayName(user) } : { status: "anonymous" });
  };
  const publishError = (error: unknown) => publish({ status: "error", message: errorMessage(error) });

  manager.events.addUserLoaded(applyUser);
  manager.events.addUserUnloaded(() => applyUser(undefined));
  manager.events.addSilentRenewError(publishError);

  try {
    const callback = isOidcCallback(browser, config.callbackPath);
    const logoutCallback = isLogoutCallback(browser, config.logoutCallbackPath);
    if (logoutCallback) {
      await manager.signoutRedirectCallback();
      browser.replaceUrl(config.postLogoutPath);
      applyUser(undefined);
    } else {
      let user = callback
        ? await manager.signinRedirectCallback()
        : await manager.getUser();
      if (callback) browser.replaceUrl(config.postLogoutPath);
      if (user?.expired) user = await manager.signinSilent();
      applyUser(user);
    }
  } catch (error) {
    currentUser = undefined;
    if (browser.pathname === config.callbackPath || browser.pathname === config.logoutCallbackPath) {
      browser.replaceUrl(config.postLogoutPath);
    }
    publishError(error);
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async login() {
      try {
        await manager.signinRedirect();
      } catch (error) {
        publishError(error);
      }
    },
    async logout() {
      try {
        await manager.signoutRedirect();
      } catch (error) {
        publishError(error);
      }
    },
    async getAccessToken() {
      if (!currentUser) return undefined;
      if (!currentUser.expired) return currentUser.access_token;

      try {
        const renewedUser = await manager.signinSilent();
        if (!renewedUser) throw new Error("OIDC 세션이 만료되었습니다. 다시 로그인하세요.");
        applyUser(renewedUser);
        return renewedUser.access_token;
      } catch (error) {
        currentUser = undefined;
        await manager.removeUser();
        publishError(error);
        return undefined;
      }
    },
  };
}
