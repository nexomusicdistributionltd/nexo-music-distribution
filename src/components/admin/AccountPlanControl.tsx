"use client";
import * as React from "react";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/Button";
import {setAccountPlanOverrideAction} from "@/app/admin/actions";
export function AccountPlanControl({userId,accountType}:{userId:string;accountType:"artist"|"label"}){
 const router=useRouter();const plans=accountType==="artist"?["artist_starter","artist_pro"]:["label_starter","label_pro"];const [plan,setPlan]=React.useState(plans[0]);const [status,setStatus]=React.useState<"active"|"trialing"|"expired"|"paused"|"canceled">("active");const [pending,setPending]=React.useState(false);const [msg,setMsg]=React.useState("");
 return <form className="flex flex-wrap items-center gap-2" onSubmit={async e=>{e.preventDefault();setPending(true);setMsg("");const r=await setAccountPlanOverrideAction({userId,accountType,planId:plan as any,status});setPending(false);setMsg(r.ok?"Plan updated immediately.":r.error);if(r.ok)router.refresh();}}>
 <select value={plan} onChange={e=>setPlan(e.target.value)} className="rounded border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-2 py-1">{plans.map(x=><option key={x}>{x}</option>)}</select>
 <select value={status} onChange={e=>setStatus(e.target.value as any)} className="rounded border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-2 py-1">{["active","trialing","expired","paused","canceled"].map(x=><option key={x}>{x}</option>)}</select>
 <Button type="submit" disabled={pending}>{pending?"Saving…":"Apply plan"}</Button>{msg?<span className="text-caption">{msg}</span>:null}</form>
}