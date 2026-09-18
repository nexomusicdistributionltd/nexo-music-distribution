"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ADMIN_SETTING_KEYS } from "@/lib/admin/settings";
import { saveAdminSettingAction } from "@/app/admin/actions";

export function SettingsForm() {
  const router = useRouter();
  const [key, setKey] = React.useState("qc.default_priority");
  const [value, setValue] = React.useState('{"priority":"normal"}');
  const [msg, setMsg] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  return (
    <form
      className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setMsg(null);
        try {
          const parsed = JSON.parse(value) as Record<string, unknown>;
          const r = await saveAdminSettingAction({ key, value: parsed });
          if (!r.ok) setMsg(r.error);
          else {
            setMsg("Saved");
            router.refresh();
          }
        } catch {
          setMsg("Value must be valid JSON object.");
        }
        setPending(false);
      }}
    >
      <h2 className="text-h4">Upsert setting</h2>
      <Select value={key} onChange={(e) => setKey(e.target.value)} aria-label="Setting key">
        {ADMIN_SETTING_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
      </Select>
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder='{"..."}' />
      {msg ? <p className="text-caption">{msg}</p> : null}
      <Button type="submit" disabled={pending}>
        Save
      </Button>
    </form>
  );
}
