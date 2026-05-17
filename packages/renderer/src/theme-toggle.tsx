import { Button } from "@git-snitch/ui/components/button";

import { useTheme } from "./theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={label}
      aria-pressed={isDark}
      onClick={toggleTheme}
      className="border-foreground/15 bg-background/80 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted"
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-current" />
      <span>{isDark ? "Light" : "Dark"}</span>
    </Button>
  );
}
