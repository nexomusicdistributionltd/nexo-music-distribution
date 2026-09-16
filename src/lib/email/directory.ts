export type DirectoryKind = "user" | "artist" | "label";

export type DirectoryRecipient = {
  key: string;
  kind: DirectoryKind;
  entityId: string;
  userId: string | null;
  email: string | null;
  label: string;
};
