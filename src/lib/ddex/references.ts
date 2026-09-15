/**
 * Message-local ERN reference ids.
 * Party P[_0-9a-zA-Z-]+ / Resource A[_0-9a-zA-Z-]+ / Technical T[_0-9a-zA-Z-]+ / Release R[_0-9a-zA-Z-]+
 */

export class ReferenceAllocator {
  private parties = new Map<string, string>();
  private partySeq = 0;

  party(stableKey: string): string {
    const existing = this.parties.get(stableKey);
    if (existing) return existing;
    this.partySeq += 1;
    const ref = `P${this.partySeq}`;
    this.parties.set(stableKey, ref);
    return ref;
  }

  hasParty(stableKey: string): boolean {
    return this.parties.has(stableKey);
  }

  audioResource(trackNumber: number): string {
    return `A${trackNumber}`;
  }

  imageResource(): string {
    return "AIMG1";
  }

  audioTechnical(trackNumber: number): string {
    return `T${trackNumber}`;
  }

  imageTechnical(): string {
    return "TIMG1";
  }

  mainRelease(): string {
    return "R0";
  }

  trackRelease(trackNumber: number): string {
    return `R${trackNumber}`;
  }
}

export function partyKey(kind: string, name: string): string {
  return `${kind}:${name.trim().toLowerCase()}`;
}
