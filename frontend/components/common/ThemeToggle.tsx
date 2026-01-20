"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // Avoid hydration mismatch
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="size-9 rounded-xl border border-border-default/20" />;
    }

    const isDark = resolvedTheme === "dark";

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={cn(
                "relative size-9 flex items-center justify-center rounded-xl transition-all duration-300 pointer-events-auto",
                "bg-surface-sunken/40 hover:bg-surface-sunken/80 border border-border-default/10",
                "group active:scale-[0.95]"
            )}
            aria-label="Toggle theme"
        >
            <div className="relative size-5 flex items-center justify-center">
                <motion.div
                    initial={false}
                    animate={{
                        rotate: isDark ? 0 : 90,
                        scale: isDark ? 0 : 1,
                        opacity: isDark ? 0 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="absolute"
                >
                    <Sun className="size-5 text-amber-500" />
                </motion.div>
                <motion.div
                    initial={false}
                    animate={{
                        rotate: isDark ? 0 : -90,
                        scale: isDark ? 1 : 0,
                        opacity: isDark ? 1 : 0,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="absolute"
                >
                    <Moon className="size-5 text-blue-400" />
                </motion.div>
            </div>
        </button>
    );
}
