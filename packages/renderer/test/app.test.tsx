import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

describe("renderer app router", () => {
  it("creates and renders the app in server-like environments without browser globals", async () => {
    expect(typeof window).toBe("undefined");

    const { App, router } = await import("../src/app");

    expect(router).toBeDefined();
    expect(() => renderToString(<App />)).not.toThrow();
  });
});
