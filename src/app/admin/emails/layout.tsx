import type { ReactNode } from "react";
import { EmailsSubnav } from "@/components/admin/EmailsSubnav";

export default function AdminEmailsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div>
      <EmailsSubnav />
      {children}
    </div>
  );
}
