import "server-only";
import { readDistributionOAuthConfig } from "./config";
import { loadDistributionAccessToken } from "./store";

export class DistributionApiHttpError extends Error {
  constructor(public readonly status:number){
    super(`Distribution Engine request failed (HTTP ${status}).`);
    this.name="DistributionApiHttpError";
  }
}

export async function distributionApiGet<T>(path:string,accessToken:string):Promise<T>{
  const cfg=readDistributionOAuthConfig();
  const base=cfg.apiBaseUrl.replace(/\/$/,"");
  const relative=path.startsWith("/")?path:`/${path}`;
  const response=await fetch(`${base}${relative}`,{
    headers:{Authorization:`Bearer ${accessToken}`,Accept:"application/json"},
    cache:"no-store",
  });
  if(!response.ok) throw new DistributionApiHttpError(response.status);
  return await response.json() as T;
}

export function verifyDistributionIdentity(accessToken:string){
  return distributionApiGet<unknown>("/me",accessToken);
}

export async function getStoredDistributionIdentityHealth():Promise<{
  ok:boolean;
  status:number|null;
  message:string;
}>{
  const token=await loadDistributionAccessToken();
  if(!token) return {ok:false,status:null,message:"Distribution Engine authorization is not stored."};
  try{
    await verifyDistributionIdentity(token);
    return {ok:true,status:200,message:"Distribution Engine API access verified."};
  }catch(e){
    if(e instanceof DistributionApiHttpError){
      return {
        ok:false,
        status:e.status,
        message:e.status===403
          ? "Authorization is stored, but the Distribution Engine denied API access (HTTP 403). Check the app permissions/scopes in the provider developer account and reconnect."
          : `Distribution Engine API verification failed (HTTP ${e.status}).`,
      };
    }
    return {ok:false,status:null,message:"Distribution Engine API verification failed."};
  }
}
