"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth, getUserPermissionsSync, UserPermissions } from "@/lib/auth-context";
import { LucideIcon } from "lucide-react";
import {
  Sparkles,
  MessageSquare,
  Phone,
  Flame,
  Settings,
  LayoutDashboard,
  Shield,
  Users,
  Target,
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
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, permissionKey: "canAccessDashboard" },
  { href: "/app/saas-money", label: "SaaS Money", icon: MessageSquare, permissionKey: "canAccessSaasMoney" },
  { href: "/app/one-of-one", label: "One of One", icon: Phone, permissionKey: "canAccessOneOfOne" },
  { href: "/app/hotset", label: "Hot-Seat", icon: Flame, permissionKey: "canAccessHotSet" },
  { href: "/app/settings", label: "Paramètres", icon: Settings, permissionKey: "canAccessSettings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Seul l'admin peut voir les liens vers les autres espaces
  const isAdmin = user?.role === "admin";
  const permissions = useMemo(
    () => user?.id && user.role === "user" ? getUserPermissionsSync(user.id) : null,
    [user?.id, user?.role]
  );
  
  // Vérifier si l'utilisateur a un forfait
  const hasPackage = permissions?.packageType !== null && permissions?.packageType !== undefined;

  return (
    <aside 
      className="bg-white border-r border-gray-100"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '16rem',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 40,
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-gray-100">
        <div className="w-10 h-10 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-soft">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-gradient">SaaS Money</span>
      </div>

      {/* Forfait Badge */}
      {hasPackage && permissions && (
        <div className="px-4 pt-4">
          <div className="px-4 py-2 bg-gradient-to-r from-magenta/10 to-orange/10 rounded-xl border border-magenta/20">
            <p className="text-xs text-gray-500">Mon forfait</p>
            <p className="text-sm font-semibold text-magenta">{permissions.packageName}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/app" && pathname.startsWith(item.href));
          
          // Vérifier les permissions
          const hasPermission = !item.permissionKey || 
            !permissions || 
            permissions[item.permissionKey] === true ||
            isAdmin; // Admin a toujours accès
          
          // Si pas de forfait, montrer tout sauf les restrictions One of One
          const showAsLocked = hasPackage && !hasPermission;
          
          if (showAsLocked) {
            // Afficher comme verrouillé
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-gray-400 cursor-not-allowed"
                title="Non disponible avec votre forfait"
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                <Lock className="w-4 h-4 text-gray-300" />
              </div>
            );
          }
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-gradient-primary text-white shadow-soft"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}

        {/* Admin section - liens vers tous les espaces */}
        {isAdmin && (
          <>
            <div className="my-4 border-t border-gray-100" />
            
            <Link
              href="/coach"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200",
                pathname.startsWith("/coach")
                  ? "bg-gradient-primary text-white shadow-soft"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Users className="w-5 h-5" />
              Espace Coach
            </Link>

            <Link
              href="/closer"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200",
                pathname.startsWith("/closer")
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-soft"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Target className="w-5 h-5" />
              Espace Closer
            </Link>

            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200",
                pathname.startsWith("/admin")
                  ? "bg-gradient-primary text-white shadow-soft"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Shield className="w-5 h-5" />
              Administration
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          © 2026 SaaS Money
        </p>
      </div>
    </aside>
  );
}
