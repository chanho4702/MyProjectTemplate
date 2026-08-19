import { AUTH_ENABLED_CONFIG, expect, items, test } from "./fixtures";

test.describe("인증이 켜진 화면", () => {
  test("로그인 전에는 보호된 API를 호출하지 않는다", async ({ page, gateway }) => {
    gateway.useRuntimeConfig(AUTH_ENABLED_CONFIG);
    gateway.onList(items());

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "로그인하면 API 연결을 시작합니다." })).toBeVisible();
    await expect(page.getByLabel("API 요청 경로")).toContainText("로그인 필요");
    await expect(page.getByRole("button", { name: /로그인 후 사용 가능/ })).toBeDisabled();
    expect(gateway.calls).toEqual([]);
  });

  test("로그인 버튼은 OIDC 제공자로 이동한다", async ({ page, gateway }) => {
    gateway.useRuntimeConfig(AUTH_ENABLED_CONFIG);
    const authorizeRequests: string[] = [];
    await page.route("**/realms/template/**", async (route) => {
      authorizeRequests.push(new URL(route.request().url()).pathname);
      await route.abort("connectionrefused");
    });

    await page.goto("/");
    await page.locator(".auth-required").getByRole("button", { name: "로그인" }).click();

    await expect
      .poll(() => authorizeRequests.some((path) => path.includes("openid-configuration") || path.includes("/auth")))
      .toBe(true);
    expect(gateway.calls).toEqual([]);
  });
});

test.describe("설정 실패", () => {
  test("app-config.json을 검증하지 못하면 부팅 오류를 설명한다", async ({ page }) => {
    await page.route("**/app-config.json", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ environment: "prod", apiBaseUrl: "http://localhost:8080", auth: { enabled: false } }),
      }),
    );

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "화면을 시작하지 못했습니다." })).toBeVisible();
    await expect(page.locator(".bootstrap-failure")).toContainText("localhost");
  });
});
