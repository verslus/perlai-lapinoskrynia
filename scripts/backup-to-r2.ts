import fs from "fs/promises";
import path from "path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const execFileAsync = promisify(execFile);

async function createPgDump(filePath: string) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL nerastas");

  await execFileAsync("pg_dump", [dbUrl, "-F", "c", "-f", filePath]);
}

async function uploadToR2(filePath: string) {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const region = process.env.R2_REGION ?? "auto";
  const prefix = process.env.R2_BACKUP_PREFIX ?? "backups";

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Trūksta R2 konfigūracijos");
  }

  const client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey }
  });

  const key = `${prefix}/backup-${new Date().toISOString().replaceAll(":", "-")}.dump`;
  const body = await fs.readFile(filePath);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/octet-stream"
    })
  );

  return key;
}

async function main() {
  const tmpPath = path.join(process.cwd(), `tmp-backup-${Date.now()}.dump`);
  try {
    await createPgDump(tmpPath);
    const key = await uploadToR2(tmpPath);
    console.log(`Backup įkeltas: ${key}`);
  } finally {
    await fs.rm(tmpPath, { force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
