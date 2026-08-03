import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface PrivateObjectStorage {
  put(workspaceId: string, objectId: string, body: Uint8Array, contentType: string): Promise<string>;
  signedReadUrl(workspaceId: string, key: string, expiresInSeconds?: number): Promise<string>;
  delete(workspaceId: string, key: string): Promise<void>;
}

export function createS3Storage(input: { client: S3Client; bucket: string }): PrivateObjectStorage {
  const scopedKey = (workspaceId: string, key: string) => {
    const prefix = `workspaces/${workspaceId}/`;
    if (key.includes("..")) throw new Error("Invalid object key");
    return key.startsWith(prefix) ? key : `${prefix}${key.replace(/^\/+/, "")}`;
  };
  return {
    async put(workspaceId, objectId, body, contentType) {
      const key = scopedKey(workspaceId, objectId);
      await input.client.send(new PutObjectCommand({ Bucket: input.bucket, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: "AES256" }));
      return key;
    },
    signedReadUrl(workspaceId, key, expiresInSeconds = 300) {
      return getSignedUrl(input.client, new GetObjectCommand({ Bucket: input.bucket, Key: scopedKey(workspaceId, key) }), { expiresIn: Math.min(expiresInSeconds, 900) });
    },
    async delete(workspaceId, key) {
      await input.client.send(new DeleteObjectCommand({ Bucket: input.bucket, Key: scopedKey(workspaceId, key) }));
    },
  };
}
