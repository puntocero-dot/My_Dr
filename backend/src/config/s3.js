const { S3Client } = require('@aws-sdk/client-s3');

// Configure S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || 'https://14fd248c321d1b3337fbf3bce630839a.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || 'ea14e2e7cc2b1c3c34690021be7e03e2',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '1840e823344ecd5a43b916c3640a627ea812bcc36c8af0edb6f24f6124ab8a62',
  },
});

const R2_BUCKET = process.env.R2_BUCKET || 'mydr-uploads-prod';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-f32a1ded82644e769e702d7d03ba922e.r2.dev';

module.exports = {
  s3Client,
  R2_BUCKET,
  R2_PUBLIC_URL
};
