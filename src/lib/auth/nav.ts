import type { AppRole } from "@/lib/auth/types";
import { hasAdminPermission } from "@/lib/admin/permissions";

export type NavItem = { href: string; label: string };

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/releases", label: "Releases" },
  { href: "/admin/qc", label: "QC Queue" },
  { href: "/admin/artists", label: "Artists" },
  { href: "/admin/labels", label: "Labels" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/finance", label: "Finance" },
  { href: "/admin/royalties", label: "Royalties" },
  { href: "/admin/statements", label: "Statements" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/publishing", label: "Publishing" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/distribution", label: "Distribution" },
  { href: "/admin/compliance", label: "Compliance" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/contact", label: "Contact" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
];

export function navForRoles(roles: AppRole[]): NavItem[] {
  if (roles.includes("super_admin") || roles.includes("admin") || roles.includes("support")) {
    return ADMIN_NAV.filter((item) => {
      if (item.href === "/admin/settings") {
        return hasAdminPermission(roles, "admin:settings");
      }
      return true;
    });
  }

  if (roles.includes("label")) {
    return [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/releases", label: "Releases" },
      { href: "/dashboard/catalog", label: "Catalog" },
      { href: "/dashboard/releases/new", label: "Create" },
      { href: "/app/artists", label: "Artists" },
      { href: "/earnings", label: "Earnings" },
      { href: "/analytics", label: "Analytics" },
      { href: "/app/publishing", label: "Publishing" },
      { href: "/dashboard/notifications", label: "Notifications" },
      { href: "/dashboard/profile", label: "Profile" },
      { href: "/dashboard/settings", label: "Settings" },
      { href: "/support", label: "Support" },
    ];
  }

  return [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/releases", label: "Releases" },
    { href: "/dashboard/catalog", label: "Catalog" },
    { href: "/dashboard/releases/new", label: "Create" },
    { href: "/earnings", label: "Earnings" },
    { href: "/analytics", label: "Analytics" },
    { href: "/app/publishing", label: "Publishing" },
    { href: "/dashboard/notifications", label: "Notifications" },
    { href: "/dashboard/profile", label: "Profile" },
    { href: "/dashboard/settings", label: "Settings" },
    { href: "/support", label: "Support" },
  ];
}
