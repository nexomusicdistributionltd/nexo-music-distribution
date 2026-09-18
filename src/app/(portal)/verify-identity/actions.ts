"use server";

import { revalidatePath } from "next/cache";
import { RequireAuth, RequireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

export type VerificationStatus = "draft"|"submitted"|"under_review"|"additional_information_required"|"verified"|"declined";
export type DocumentType = "nin"|"national_id"|"drivers_license"|"passport";

export async function saveVerificationIdentityAction(input:{countryCode:string;legalFullName:string;dateOfBirth:string;documentType:DocumentType}) {
  const ctx=await RequireAuth({redirectTo:"/login"});
  if (!ctx.roles.includes("artist") && !ctx.roles.includes("label")) return {ok:false,error:"Artist or label account required."};
  if(!/^[A-Z]{2}$/.test(input.countryCode)||!input.legalFullName.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth)) return {ok:false,error:"Complete all identity fields."};
  const supabase=await createClient();
  const {data,error}=await supabase.from("identity_verifications").upsert({
    user_id:ctx.userId,account_type:ctx.roles.includes("label")?"label":"artist",country_code:input.countryCode,
    legal_full_name:input.legalFullName.trim(),date_of_birth:input.dateOfBirth,document_type:input.documentType,status:"draft"
  },{onConflict:"user_id"}).select("id,status").single();
  if(error) return {ok:false,error:error.message};
  return {ok:true,id:data.id,status:data.status as VerificationStatus};
}

export async function registerVerificationEvidenceAction(input:{verificationId:string;evidenceType:"document_front"|"document_back"|"selfie";storagePath:string;mimeType:string;sizeBytes:number}) {
  const ctx=await RequireAuth({redirectTo:"/login"});
  if(!input.storagePath.startsWith(ctx.userId+"/")) return {ok:false,error:"Invalid evidence path."};
  const supabase=await createClient();
  const {data:v}=await supabase.from("identity_verifications").select("id,user_id,status").eq("id",input.verificationId).eq("user_id",ctx.userId).maybeSingle();
  if(!v||!["draft","additional_information_required"].includes(v.status)) return {ok:false,error:"Verification is not editable."};
  const {error}=await supabase.from("identity_verification_evidence").upsert({
    verification_id:input.verificationId,user_id:ctx.userId,evidence_type:input.evidenceType,storage_path:input.storagePath,mime_type:input.mimeType,size_bytes:input.sizeBytes
  },{onConflict:"verification_id,evidence_type"});
  return error?{ok:false,error:error.message}:{ok:true};
}

export async function submitIdentityVerificationAction(verificationId:string){
  await RequireAuth({redirectTo:"/login"});
  const supabase=await createClient();
  const {error}=await supabase.rpc("submit_identity_verification",{p_verification_id:verificationId});
  if(error)return {ok:false,error:error.message};
  revalidatePath("/verify-identity");revalidatePath("/dashboard");return {ok:true};
}

export async function reviewIdentityVerificationAction(input:{verificationId:string;status:"verified"|"declined"|"additional_information_required"|"under_review";reason?:string}){
  await RequireAdmin();
  const supabase=await createClient();
  const {error}=await supabase.rpc("review_identity_verification",{p_verification_id:input.verificationId,p_status:input.status,p_reason:input.reason?.trim()||null});
  if(error)return {ok:false,error:error.message};
  revalidatePath("/admin/verifications");revalidatePath("/admin/users");return {ok:true};
}

export async function getVerificationEvidenceUrls(verificationId:string){
  await RequireAdmin();
  const service=createServiceClient();
  const {data:rows,error}=await service.from("identity_verification_evidence").select("evidence_type,storage_path,captured_at").eq("verification_id",verificationId);
  if(error) throw error;
  return Promise.all((rows??[]).map(async row=>{
    const {data}=await service.storage.from("identity-verification").createSignedUrl(row.storage_path,300);
    return {...row,url:data?.signedUrl??null};
  }));
}
