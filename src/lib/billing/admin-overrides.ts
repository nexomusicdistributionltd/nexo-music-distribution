import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import type { BillingAccountType, TierId } from "./plans";
import type { BillingEntitlements } from "./entitlements";

export type AdminPlanOverride={user_id:string;account_type:BillingAccountType;plan_id:TierId;status:string;starts_at:string;ends_at:string|null;reason:string|null};
export async function getAdminPlanOverride(userId:string):Promise<AdminPlanOverride|null>{
 const db=createServiceClient(); const {data,error}=await db.from("billing_entitlement_overrides").select("*").eq("user_id",userId).maybeSingle(); if(error) throw error; return data as AdminPlanOverride|null;
}
export function applyAdminPlanOverride(base:BillingEntitlements,o:AdminPlanOverride|null,now=new Date()):BillingEntitlements{
 if(!o)return base; const started=Date.parse(o.starts_at)<=now.getTime(); const notEnded=!o.ends_at||Date.parse(o.ends_at)>now.getTime(); const paid=o.plan_id!=="artist_starter"; const active=started&&notEnded&&(o.status==="active"||o.status==="trialing");
 return {...base,accountType:o.account_type,planId:o.plan_id,paidAccess:active&&paid,status:active?o.status:(o.status==="active"?"expired":o.status),currentPeriodEndsAt:o.ends_at,cancelAtPeriodEnd:false,grandfathered:!active,source:base.source,policy:active?`Administrative plan grant: ${o.plan_id}.`:`Administrative plan override is ${o.status}; paid entitlements are off.`};
}
