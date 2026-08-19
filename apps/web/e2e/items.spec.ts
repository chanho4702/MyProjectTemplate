import { created, expect, hang, items, problem, test, unreachable } from "./fixtures";

const FIRST_ITEM = { id: "0d1758c1-5a47-4bc3-84cb-f1887bcfa734", name: "first-item", createdAt: "2026-08-16T00:00:00Z" };
const SECOND_ITEM = { id: "1a2758c1-5a47-4bc3-84cb-f1887bcfa735", name: "second-item", createdAt: "2026-08-16T01:00:00Z" };

test.describe("항목 조회", () => {
  test("응답을 기다리는 동안 로딩 상태를 보여준다", async ({ page, gateway }) => {
    gateway.onList(hang());

    await page.goto("/");

    await expect(page.getByRole("status")).toContainText("Gateway에서 항목을 불러오고 있습니다.");
    await expect(page.getByLabel("API 요청 경로")).toContainText("요청 중");
  });

  test("응답이 0건이면 다음 행동을 안내한다", async ({ page, gateway }) => {
    gateway.onList(items());

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "아직 저장된 항목이 없습니다." })).toBeVisible();
    expect(gateway.calls).toEqual(["GET /api/v1/items"]);
  });

  test("응답 순서대로 목록을 그린다", async ({ page, gateway }) => {
    gateway.onList(items(FIRST_ITEM, SECOND_ITEM));

    await page.goto("/");

    await expect(page.locator(".item-list li")).toHaveCount(2);
    await expect(page.locator(".item-list li").first()).toContainText("first-item");
    await expect(page.locator(".panel-actions")).toContainText("2 records");
  });
});

test.describe("항목 조회 실패", () => {
  test("서버 오류는 request ID와 다시 시도를 함께 보여주고 복구된다", async ({ page, gateway }) => {
    gateway.onList(
      problem({ status: 503, detail: "sample-service is not reachable", requestId: "gateway-request-0001" }),
      items(FIRST_ITEM),
    );

    await page.goto("/");

    const notice = page.getByRole("alert");
    await expect(notice).toContainText("서버가 요청을 처리하지 못했습니다.");
    await expect(notice).toContainText("sample-service is not reachable");
    await expect(notice).toContainText("gateway-request-0001");
    await expect(page.getByLabel("API 요청 경로")).toContainText("확인 필요");

    await notice.getByRole("button", { name: "다시 시도" }).click();

    await expect(page.getByText("first-item")).toBeVisible();
    await expect(page.getByRole("alert")).toBeHidden();
    expect(gateway.calls).toEqual(["GET /api/v1/items", "GET /api/v1/items"]);
  });

  test("연결 자체가 끊기면 Gateway 확인을 안내한다", async ({ page, gateway }) => {
    gateway.onList(unreachable());

    await page.goto("/");

    await expect(page.getByRole("alert")).toContainText("Gateway에 연결하지 못했습니다.");
    await expect(page.getByRole("alert")).toContainText("Gateway와 sample-service가 실행 중인지 확인한 뒤 다시 불러오세요.");
  });

  test("권한 없음은 다시 시도 버튼 없이 안내만 남긴다", async ({ page, gateway }) => {
    gateway.onList(problem({ status: 403, detail: "role is missing" }));

    await page.goto("/");

    const notice = page.getByRole("alert");
    await expect(notice).toContainText("이 작업을 수행할 권한이 없습니다.");
    await expect(notice.getByRole("button")).toHaveCount(0);
  });
});

test.describe("항목 생성", () => {
  test("생성한 항목이 목록 첫 줄에 붙는다", async ({ page, gateway }) => {
    gateway.onList(items(FIRST_ITEM));
    gateway.onCreate(created(SECOND_ITEM));

    await page.goto("/");
    await expect(page.getByText("first-item")).toBeVisible();

    await page.getByLabel("항목 이름").fill("second-item");
    await page.getByRole("button", { name: /writer DB에 저장/ }).click();

    await expect(page.locator(".item-list li").first()).toContainText("second-item");
    await expect(page.locator(".form-message")).toContainText("writer DB에 저장했습니다.");
    expect(gateway.createdNames).toEqual(["second-item"]);
  });

  test("서버 validation 오류를 필드 단위로 보여준다", async ({ page, gateway }) => {
    gateway.onList(items());
    gateway.onCreate(
      problem({
        status: 400,
        detail: "Request validation failed",
        code: "validation_error",
        requestId: "gateway-request-0002",
        violations: [{ field: "name", message: "must not be blank" }],
      }),
    );

    await page.goto("/");
    await page.getByLabel("항목 이름").fill("bad-item");
    await page.getByRole("button", { name: /writer DB에 저장/ }).click();

    const notice = page.getByRole("alert");
    await expect(notice).toContainText("입력값을 확인해야 합니다.");
    await expect(notice).toContainText("must not be blank");
    await expect(notice).toContainText("gateway-request-0002");
  });

  test("빈 이름은 요청을 보내지 않고 폼에서 막는다", async ({ page, gateway }) => {
    gateway.onList(items());

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "아직 저장된 항목이 없습니다." })).toBeVisible();

    await page.getByRole("button", { name: /writer DB에 저장/ }).click();

    await expect(page.locator(".form-message")).toContainText("항목 이름을 입력하세요.");
    expect(gateway.calls).toEqual(["GET /api/v1/items"]);
  });
});
