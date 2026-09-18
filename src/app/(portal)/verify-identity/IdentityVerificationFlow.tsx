"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { COUNTRY_CODES,countryFlag,countryName } from "@/lib/verification/countries";
import { saveVerificationIdentityAction,registerVerificationEvidenceAction,submitIdentityVerificationAction,type DocumentType } from "./actions";

type EvidenceType="document_front"|"document_back"|"selfie";
type Captured=Partial<Record<EvidenceType,boolean>>;

export function IdentityVerificationFlow({userId,initial}:{userId:string;initial?:{id:string;status:string;country_code:string;legal_full_name:string;date_of_birth:string;document_type:DocumentType}|null}){
 const router=useRouter(); const supabase=React.useMemo(()=>createClient(),[]);
 const [verificationId,setVerificationId]=React.useState(initial?.id??"");
 const [status,setStatus]=React.useState(initial?.status??"draft");
 const [step,setStep]=React.useState(initial?.id?2:1);
 const [country,setCountry]=React.useState(initial?.country_code??"NG");
 const [name,setName]=React.useState(initial?.legal_full_name??"");
 const [dob,setDob]=React.useState(initial?.date_of_birth??"");
 const [doc,setDoc]=React.useState<DocumentType>(initial?.document_type??"nin");
 const [capture,setCapture]=React.useState<EvidenceType|null>(null);
 const [captured,setCaptured]=React.useState<Captured>({});
 const [busy,setBusy]=React.useState(false); const [message,setMessage]=React.useState("");
 const videoRef=React.useRef<HTMLVideoElement>(null); const streamRef=React.useRef<MediaStream|null>(null);

 React.useEffect(()=>()=>streamRef.current?.getTracks().forEach(t=>t.stop()),[]);
 React.useEffect(()=>{
   if(!verificationId)return;
   const channel=supabase.channel(`identity-verification-${verificationId}`).on("postgres_changes",{event:"UPDATE",schema:"public",table:"identity_verifications",filter:`id=eq.${verificationId}`},payload=>{
     const next=String((payload.new as {status?:string}).status??"");
     if(next){setStatus(next);router.refresh();}
   }).subscribe();
   return ()=>{void supabase.removeChannel(channel);};
 },[verificationId,router,supabase]);
 React.useEffect(()=>{if(!capture)return; navigator.mediaDevices?.getUserMedia({video:{facingMode:capture==="selfie"?"user":{ideal:"environment"}},audio:false}).then(stream=>{streamRef.current=stream;if(videoRef.current)videoRef.current.srcObject=stream;}).catch(()=>{setMessage("Camera access is required. Allow camera permission and try again.");setCapture(null);});},[capture]);

 async function saveIdentity(){setBusy(true);setMessage("");const r=await saveVerificationIdentityAction({countryCode:country,legalFullName:name,dateOfBirth:dob,documentType:doc});setBusy(false);if(!r.ok){setMessage(r.error);return;}setVerificationId(r.id);setStep(2);}
 async function takePhoto(){
   if(!capture||!videoRef.current||!verificationId)return;
   setBusy(true);setMessage(""); const video=videoRef.current; const canvas=document.createElement("canvas");
   canvas.width=video.videoWidth||1280;canvas.height=video.videoHeight||720;canvas.getContext("2d")?.drawImage(video,0,0,canvas.width,canvas.height);
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",0.9));
   if(!blob){setBusy(false);setMessage("Could not capture image.");return;}
   const path=`${userId}/${verificationId}/${capture}-${Date.now()}.jpg`;
   const {error}=await supabase.storage.from("identity-verification").upload(path,blob,{contentType:"image/jpeg",upsert:false});
   if(error){setBusy(false);setMessage(error.message);return;}
   const r=await registerVerificationEvidenceAction({verificationId,evidenceType:capture,storagePath:path,mimeType:"image/jpeg",sizeBytes:blob.size});
   if(!r.ok){setBusy(false);setMessage(r.error);return;}
   setCaptured(v=>({...v,[capture]:true})); streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;setCapture(null);setBusy(false);
 }
 async function submit(){setBusy(true);const r=await submitIdentityVerificationAction(verificationId);setBusy(false);if(!r.ok){setMessage(r.error);return;}setStatus("submitted");setStep(4);router.refresh();}
 if(["submitted","under_review","verified"].includes(status)) return <StatusPanel status={status}/>;
 return <div className="mx-auto max-w-2xl space-y-6">
   <div><p className="text-caption font-semibold uppercase tracking-[.16em] text-[var(--nexo-text-muted)]">Identity verification</p><h1 className="mt-2 text-h2">Verify your identity</h1><p className="mt-2 text-small text-[var(--nexo-text-secondary)]">Required for artist and label accounts. Your legal name and date of birth must match your identity document.</p></div>
   <div className="flex gap-2">{[1,2,3,4].map(n=><div key={n} className={"h-1 flex-1 rounded "+(n<=step?"bg-[var(--nexo-text)]":"bg-[var(--nexo-border)]")}/>)}</div>
   {message?<div className="rounded-lg border border-amber-500/40 p-3 text-small">{message}</div>:null}
   {step===1?<section className="space-y-4 rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5">
     <label className="block text-small font-medium">Country<select value={country} onChange={e=>setCountry(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--nexo-border)] bg-[var(--nexo-bg)] p-3">{COUNTRY_CODES.map(c=><option key={c} value={c}>{countryFlag(c)} {countryName(c)}</option>)}</select></label>
     <label className="block text-small font-medium">Full legal name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" className="mt-1 w-full rounded-lg border border-[var(--nexo-border)] bg-[var(--nexo-bg)] p-3"/></label>
     <label className="block text-small font-medium">Date of birth<input type="date" value={dob} onChange={e=>setDob(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--nexo-border)] bg-[var(--nexo-bg)] p-3"/></label>
     <button disabled={busy||!name||!dob} onClick={saveIdentity} className="w-full rounded-lg bg-[var(--nexo-text)] p-3 font-semibold text-[var(--nexo-text-inverse)]">{busy?"Saving…":"Continue"}</button>
   </section>:null}
   {step===2?<section className="space-y-4 rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5"><h2 className="text-h4">Select your document</h2>
     {([["nin","NIN"],["national_id","ID Card"],["drivers_license","Driver’s License"],["passport","International Passport"]] as const).map(([v,l])=><button key={v} onClick={()=>{setDoc(v);setStep(3);}} className="flex w-full items-center justify-between rounded-lg border border-[var(--nexo-border)] p-4 text-left hover:bg-[var(--nexo-ghost-hover)]"><span>{l}</span><span>Continue →</span></button>)}
   </section>:null}
   {step===3?<section className="space-y-4 rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5"><h2 className="text-h4">Live camera capture</h2><p className="text-small text-[var(--nexo-text-secondary)]">Manual file uploads are disabled. Capture the original document and your face live.</p>
     {(["document_front","document_back","selfie"] as EvidenceType[]).map(t=><button key={t} disabled={busy} onClick={()=>setCapture(t)} className="flex w-full items-center gap-3 rounded-lg border border-[var(--nexo-border)] p-4"><Camera className="h-5 w-5"/><span className="flex-1 text-left">{t==="document_front"?"Document front":t==="document_back"?"Document back":"Face verification selfie"}</span>{captured[t]?<CheckCircle2 className="h-5 w-5"/>:null}</button>)}
     <button disabled={busy||!captured.document_front||!captured.document_back||!captured.selfie} onClick={submit} className="w-full rounded-lg bg-[var(--nexo-text)] p-3 font-semibold text-[var(--nexo-text-inverse)]">{busy?"Submitting securely…":"Submit verification"}</button>
   </section>:null}
   {capture?<div className="fixed inset-0 z-[100] flex flex-col bg-black p-4 text-white"><div className="mx-auto flex w-full max-w-2xl flex-1 flex-col"><div className="flex items-center justify-between py-3"><strong>{capture==="selfie"?"Face verification":"Document capture"}</strong><button onClick={()=>{streamRef.current?.getTracks().forEach(t=>t.stop());setCapture(null)}}>Cancel</button></div><video ref={videoRef} autoPlay playsInline muted className="min-h-0 flex-1 rounded-xl object-cover"/><button disabled={busy} onClick={takePhoto} className="my-4 rounded-full bg-white p-4 font-semibold text-black">{busy?"Uploading…":"Take photo"}</button></div></div>:null}
 </div>
}
function StatusPanel({status}:{status:string}){return <div className="mx-auto max-w-xl rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-8 text-center"><ShieldCheck className="mx-auto h-10 w-10"/><h1 className="mt-4 text-h3">{status==="verified"?"Identity verified":"Verification submitted"}</h1><p className="mt-2 text-small text-[var(--nexo-text-secondary)]">{status==="verified"?"Your Nexo account is verified. The verified badge is now active on your account.":"Your live identity evidence is securely stored and awaiting admin review. You’ll be notified when the review changes."}</p>{status==="verified"?<a href="/dashboard" className="mt-5 inline-flex rounded-lg bg-black px-4 py-2 text-small font-semibold text-white">Continue to dashboard</a>:null}</div>}
