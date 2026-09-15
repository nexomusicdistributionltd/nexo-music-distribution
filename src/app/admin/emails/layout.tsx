import { EmailsSubnav } from "@/components/admin/EmailsSubnav";

export default function AdminEmailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <EmailsSubnav />
      {children}
    </div>
  );
}
