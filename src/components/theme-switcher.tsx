"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ThemeSwitcherProps {
  className?: string;
  compact?: boolean;
}

export function ThemeSwitcher({ className, compact }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();

  const buttons = [
    { value: "light", icon: Sun, title: "亮色模式" },
    { value: "dark", icon: Moon, title: "暗色模式" },
    { value: "system", icon: Monitor, title: "跟随系统" },
  ];

  return (
    <div className={cn(className)}>
      <div className="bg-muted text-muted-foreground inline-flex h-9 w-full items-center justify-center rounded-lg p-1">
        {buttons.map(({ value, icon: Icon, title }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              "ring-offset-background focus-visible:ring-ring inline-flex flex-1 items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
              theme === value
                ? "bg-background text-foreground shadow-sm"
                : "hover:bg-muted-foreground/10",
              compact && "px-1.5"
            )}
            title={title}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
