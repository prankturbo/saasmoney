"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth, getUserPermissionsSync, UserPermissions } from "@/lib/auth-context";
import { LucideIcon } from "lucide-react";
import {
  MessageSquare,
  Phone,
  Flame,
  LayoutDashboard,
  Lock,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permissionKey?: keyof Pick<UserPermissions, 
    'canAccessDashboard' | 'canAccessSaasMoney' | 'canAccessOneOfOne' | 'canAccessHotSet' | 'canAccessSettings'
  >;
}

const navItems: NavItem[] = [
  { href: "/app", label: "Home", icon: LayoutDashboard, permissionKey: "canAccessDashboard" },
  { href: "/app/saas-money", label: "IA", icon: MessageSquare, permissionKey: "canAccessSaasMoney" },
  { href: "/app/one-of-one", label: "Calls", icon: Phone, permissionKey: "canAccessOneOfOne" },
  { href: "/app/hotset", label: "Hot-Seat", icon: Flame, permissionKey: "canAccessHotSet" },
];

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";
  const permissions = useMemo(
    () => user?.id && user.role === "user" ? getUserPermissionsSync(user.id) : null,
    [user?.id, user?.role]
  );

  const hasPackage = permissions?.packageType !== null && permissions?.packageType !== undefined;

  return (
    <nav id="mobile-nav" className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-2 z-50">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/app" && pathname.startsWith(item.href));

          // Vérifier les permissions
          const hasPermission = !item.permissionKey || 
            !permissions || 
            permissions[item.permissionKey] === true ||
            isAdmin;
          
          const showAsLocked = hasPackage && !hasPermission;

          if (showAsLocked) {
            return (
              <div
                key={item.href}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl text-gray-300 cursor-not-allowed"
                title="Non disponible avec votre forfait"
              >
                <div className="p-2 rounded-2xl bg-gray-100 relative">
                  <item.icon className="w-5 h-5" />
                  <Lock className="w-3 h-3 absolute -top-1 -right-1 text-gray-400" />
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200",
                isActive
                  ? "text-magenta"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <div
                className={cn(
                  "p-2 rounded-2xl transition-all duration-200",
                  isActive && "bg-gradient-primary shadow-soft"
                )}
              >
                <item.icon
                  className={cn("w-5 h-5", isActive && "text-white")}
                />
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
