import { Readable } from "node:stream";
import type { DdexPackageManifest, DdexProtocol } from "../types";
import { DdexTransportNotConnectedError } from "../transport";

export type ProtocolDeliveryRequest = {
  manifest: DdexPackageManifest;
  xml: string;
  filename: string;
  directory?: string;
};

export type ProtocolDeliveryResult = {
  delivered: boolean;
  protocol: DdexProtocol;
  acknowledgmentId?: string;
  bytesTransferred: number;
  reason?: string;
};

export interface ProtocolAdapter {
  readonly protocol: DdexProtocol;
  readonly connected: boolean;
  deliver(request: ProtocolDeliveryRequest): Promise<ProtocolDeliveryResult>;
}

export class ProtocolNotConnectedError extends DdexTransportNotConnectedError {
  constructor(protocol: DdexProtocol) {
    super(`${protocol.toUpperCase()} target is NOT CONNECTED. Credentials are missing or the target is inactive.`);
  }
}

type PutObject = (path: string, body: Buffer, contentType: string) => Promise<void>;

/** Isolated TEST protocol — writes ERN + manifest to a private sink. Not a commercial DSP. */
export class LocalProtocolAdapter implements ProtocolAdapter {
  readonly protocol = "local" as const;
  readonly connected: boolean;

  constructor(
    private readonly put: PutObject,
    connected = true
  ) {
    this.connected = connected;
  }

  async deliver(request: ProtocolDeliveryRequest): Promise<ProtocolDeliveryResult> {
    if (!this.connected) throw new ProtocolNotConnectedError("local");
    const prefix = `${request.manifest.releaseId}/${request.manifest.messageId}`;
    const xmlBuf = Buffer.from(request.xml, "utf8");
    const manifestBuf = Buffer.from(JSON.stringify(request.manifest, null, 2), "utf8");
    await this.put(`${prefix}/${request.filename}`, xmlBuf, "application/xml; charset=utf-8");
    await this.put(`${prefix}/manifest.json`, manifestBuf, "application/json; charset=utf-8");
    return {
      delivered: true,
      protocol: "local",
      acknowledgmentId: `local:${request.manifest.messageId}`,
      bytesTransferred: xmlBuf.length + manifestBuf.length,
    };
  }
}

async function importOptional(moduleName: string): Promise<Record<string, unknown> | null> {
  try {
    return (await (Function("n", "return import(n)") as (n: string) => Promise<Record<string, unknown>>)(
      moduleName
    )) as Record<string, unknown>;
  } catch {
    return null;
  }
}

type FtpClient = {
  access: (opts: object) => Promise<void>;
  ensureDir: (d: string) => Promise<void>;
  uploadFrom: (s: unknown, n: string) => Promise<void>;
  close: () => void;
};

function requireCreds(connected: boolean, protocol: DdexProtocol) {
  if (!connected) throw new ProtocolNotConnectedError(protocol);
}

/**
 * FTP adapter (Stardust-inspired). Activates only with real credentials.
 * Does not ship a commercial DSP host. Dynamic-imports basic-ftp when connected.
 */
export class FtpProtocolAdapter implements ProtocolAdapter {
  readonly protocol = "ftp" as const;
  constructor(
    readonly connected: boolean,
    private readonly creds?: { host: string; user: string; password: string; port?: number; directory?: string }
  ) {}
  async deliver(request: ProtocolDeliveryRequest): Promise<ProtocolDeliveryResult> {
    requireCreds(this.connected, "ftp");
    const ftp = await importOptional("basic-ftp");
    if (!ftp || typeof ftp.Client !== "function") {
      throw new Error("FTP protocol is implemented but basic-ftp is not installed. Do not activate an FTP target yet.");
    }
    const Client = ftp.Client as new () => FtpClient;
    const client = new Client();
    try {
      await client.access({
        host: this.creds!.host,
        user: this.creds!.user,
        password: this.creds!.password,
        port: this.creds!.port ?? 21,
      });
      if (this.creds!.directory) await client.ensureDir(this.creds!.directory);
      const buf = Buffer.from(request.xml, "utf8");
      await client.uploadFrom(Readable.from(buf), request.filename);
      return { delivered: true, protocol: "ftp", bytesTransferred: buf.length };
    } finally {
      client.close();
    }
  }
}

export class SftpProtocolAdapter implements ProtocolAdapter {
  readonly protocol = "sftp" as const;
  constructor(
    readonly connected: boolean,
    private readonly creds?: { host: string; user: string; password: string; port?: number; directory?: string }
  ) {}
  async deliver(request: ProtocolDeliveryRequest): Promise<ProtocolDeliveryResult> {
    void request;
    requireCreds(this.connected, "sftp");
    const ssh = await importOptional("ssh2");
    if (!ssh) {
      throw new Error("SFTP protocol is implemented but ssh2 is not installed. Do not activate an SFTP target yet.");
    }
    throw new Error("SFTP target has credentials but runtime delivery is gated until a commercial receiver is approved.");
  }
}

export class S3ProtocolAdapter implements ProtocolAdapter {
  readonly protocol = "s3" as const;
  constructor(
    readonly connected: boolean,
    private readonly creds?: { bucket: string; accessKeyId: string; secretAccessKey: string; region?: string }
  ) {}
  async deliver(request: ProtocolDeliveryRequest): Promise<ProtocolDeliveryResult> {
    void request;
    requireCreds(this.connected, "s3");
    const s3 = await importOptional("@aws-sdk/client-s3");
    if (!s3) {
      throw new Error("S3 protocol is implemented but @aws-sdk/client-s3 is not installed. Do not activate an S3 target yet.");
    }
    throw new Error("S3 target has credentials but runtime delivery is gated until a commercial receiver is approved.");
  }
}

export class RestProtocolAdapter implements ProtocolAdapter {
  readonly protocol = "rest" as const;
  constructor(
    readonly connected: boolean,
    private readonly creds?: { endpoint: string; token?: string }
  ) {}
  async deliver(request: ProtocolDeliveryRequest): Promise<ProtocolDeliveryResult> {
    requireCreds(this.connected, "rest");
    const headers: Record<string, string> = { "Content-Type": "application/xml; charset=utf-8" };
    if (this.creds!.token) headers.Authorization = `Bearer ${this.creds!.token}`;
    const res = await fetch(this.creds!.endpoint, { method: "POST", headers, body: request.xml });
    if (!res.ok) {
      throw new Error(`REST delivery failed with HTTP ${res.status}.`);
    }
    return {
      delivered: true,
      protocol: "rest",
      acknowledgmentId: res.headers.get("x-ack-id") || undefined,
      bytesTransferred: Buffer.byteLength(request.xml, "utf8"),
    };
  }
}

export class AzureProtocolAdapter implements ProtocolAdapter {
  readonly protocol = "azure" as const;
  constructor(
    readonly connected: boolean,
    private readonly creds?: { connectionString: string; container: string }
  ) {}
  async deliver(request: ProtocolDeliveryRequest): Promise<ProtocolDeliveryResult> {
    void request;
    requireCreds(this.connected, "azure");
    const azure = await importOptional("@azure/storage-blob");
    if (!azure) {
      throw new Error("Azure protocol is implemented but @azure/storage-blob is not installed. Do not activate an Azure target yet.");
    }
    throw new Error("Azure target has credentials but runtime delivery is gated until a commercial receiver is approved.");
  }
}

export function adapterForTarget(input: {
  protocol: DdexProtocol;
  connected: boolean;
  isTest: boolean;
  put?: PutObject;
  env?: NodeJS.ProcessEnv;
  prefix?: string | null;
}): ProtocolAdapter {
  const env = input.env ?? process.env;
  const p = (input.prefix ?? "").trim();
  if (input.protocol === "local") {
    if (!input.put) throw new Error("Local protocol requires a storage sink.");
    return new LocalProtocolAdapter(input.put, input.connected);
  }
  if (input.protocol === "ftp") {
    return new FtpProtocolAdapter(input.connected, {
      host: env[`${p}HOST`] ?? "",
      user: env[`${p}USER`] ?? "",
      password: env[`${p}PASSWORD`] ?? "",
      port: Number(env[`${p}PORT`] || 21),
      directory: env[`${p}DIRECTORY`] || undefined,
    });
  }
  if (input.protocol === "sftp") {
    return new SftpProtocolAdapter(input.connected, {
      host: env[`${p}HOST`] ?? "",
      user: env[`${p}USER`] ?? "",
      password: env[`${p}PASSWORD`] ?? "",
      port: Number(env[`${p}PORT`] || 22),
      directory: env[`${p}DIRECTORY`] || undefined,
    });
  }
  if (input.protocol === "s3") {
    return new S3ProtocolAdapter(input.connected, {
      bucket: env[`${p}BUCKET`] ?? "",
      accessKeyId: env[`${p}ACCESS_KEY_ID`] ?? "",
      secretAccessKey: env[`${p}SECRET_ACCESS_KEY`] ?? "",
      region: env[`${p}REGION`] || undefined,
    });
  }
  if (input.protocol === "rest") {
    return new RestProtocolAdapter(input.connected, {
      endpoint: env[`${p}ENDPOINT`] ?? "",
      token: env[`${p}TOKEN`] || undefined,
    });
  }
  return new AzureProtocolAdapter(input.connected, {
    connectionString: env[`${p}CONNECTION_STRING`] ?? "",
    container: env[`${p}CONTAINER`] ?? "",
  });
}
