"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Receipt,
  Package,
  Settings,
  BarChart3,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StandardLabel, Title3 } from "./index";

export const navGroups = [
  {
    label: "Navigation",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard, color: "var(--color-action-primary)" },
      { name: "Orders", href: "/po", icon: ShoppingCart, color: "var(--color-status-info)" },
      { name: "Delivery Challans", href: "/dc", icon: Truck, color: "var(--color-status-warning)" },
      { name: "Invoices", href: "/invoice", icon: Receipt, color: "var(--color-status-success)" },
      { name: "SRV", href: "/srv", icon: Package, color: "var(--color-status-error)" },
      { name: "Reports", href: "/reports", icon: BarChart3, color: "var(--color-action-primary)" },
    ]
  },
  {
    label: "System",
    items: [
      { name: "Settings", href: "/settings", icon: Settings, color: "var(--color-text-secondary)" },
    ]
  }
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="flex-shrink-0 flex flex-col bg-surface-secondary w-64 h-full relative z-20 border-r border-border-default shadow-[4px_0_24px_-4px_rgba(0,0,0,0.2)]"
    >
      {/* Premium Logo Area */}
      <div className="flex items-center gap-3 px-6 h-20 shrink-0 mb-4 mt-2">
        <div className="flex items-center gap-3 group cursor-default">
          <motion.div
            whileHover={{ rotate: 12, scale: 1.05 }}
            className="size-10 rounded-xl bg-gradient-to-br from-action-primary to-action-primary-hover flex items-center justify-center text-white shadow-[0_0_20px_rgba(var(--color-action-primary),0.3)] border border-white/10"
          >
            <Sparkles className="w-5 h-5" />
          </motion.div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-text-primary">
              SenstoSales
            </span>
            <span className="text-[10px] font-medium text-action-primary uppercase tracking-[0.2em] opacity-80">
              Antigravity
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-2 flex flex-col overflow-y-auto no-scrollbar gap-2">
        <LayoutGroup>
          {navGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="mb-4">
              {/* Section Header */}
              <div className="px-4 py-2 mb-1">
                <StandardLabel className="opacity-40">
                  {group.label}
                </StandardLabel>
              </div>

              {/* Navigation Items */}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href + "/"));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 relative group",
                        isActive
                          ? "text-action-primary"
                          : "text-text-secondary hover:text-text-primary"
                      )}
                    >
                      {/* Active Indicator Background */}
                      <AnimatePresence>
                        {isActive && (
                          <motion.div
                            layoutId="active-pill"
                            className="absolute inset-0 bg-action-primary/10 rounded-xl border border-action-primary/20 z-0 shadow-[0_0_12px_rgba(var(--color-action-primary),0.05)]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          />
                        )}
                      </AnimatePresence>

                      <motion.div
                        whileHover={{ scale: 1.1, rotate: -5 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "relative z-10 transition-colors duration-300",
                          isActive ? "text-action-primary" : "opacity-60 group-hover:opacity-100"
                        )}
                      >
                        <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                      </motion.div>

                      <span className="relative z-10 tracking-tight flex-1">
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </LayoutGroup>
      </nav>

      {/* Bottom Footer - System Info */}
      <div className="px-4 py-4 border-t border-border-default/10 bg-surface-sunken/10 mt-auto">
        <div className="space-y-4">
          <div className="px-1 flex items-center justify-between">
            <StandardLabel className="opacity-20 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-status-success animate-pulse" />
              v3.4.0 (Stable)
            </StandardLabel>
            <Sparkles className="size-3.5 text-action-primary opacity-30 cursor-help hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

