export const PAID_PLAN_COMMISSION_BPS=1000;
export const FREE_PLAN_COMMISSION_BPS=2000;
export function royaltyCommission(grossMinor:number,paidAccess:boolean){if(!Number.isSafeInteger(grossMinor)||grossMinor<0)throw new Error("Gross royalty must be a non-negative integer minor-unit amount.");const bps=paidAccess?PAID_PLAN_COMMISSION_BPS:FREE_PLAN_COMMISSION_BPS;const commissionMinor=Math.round(grossMinor*bps/10000);return {grossMinor,commissionBps:bps,commissionMinor,ownerNetMinor:grossMinor-commissionMinor};}
