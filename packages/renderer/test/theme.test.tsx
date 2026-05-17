// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "../src/theme";
import { ThemeToggle } from "../src/theme-toggle";

const storageKey = "git-snitch-test-theme";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
});

describe("renderer theme", () => {
  it("persists a toggled dark theme and applies the standalone document class", async () => {
    render(
      <ThemeProvider storageKey={storageKey} defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>,
    );

    const toggle = await screen.findByRole("button", { name: "Switch to dark theme" });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(window.localStorage.getItem(storageKey)).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.style.colorScheme).toBe("dark");
      expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeTruthy();
    });
  });

  it("restores a persisted theme before user interaction", async () => {
    window.localStorage.setItem(storageKey, "dark");

    render(
      <ThemeProvider storageKey={storageKey} defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeTruthy();
    });
  });

  it("renders on the server without browser globals", () => {
    const markup = renderToString(
      <ThemeProvider storageKey={storageKey} defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(markup).toContain("Switch to dark theme");
  });
});
