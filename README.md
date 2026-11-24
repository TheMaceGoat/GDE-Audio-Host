# GDE Audio Host

Upload audio files to Vercel Blob and copy a direct URL for use in GDE. Recent
upload details are stored in Upstash Redis.

## Run locally

Use Node.js 20 or newer and configure these environment variables:

- `BLOB_READ_WRITE_TOKEN`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Then run:

```sh
npm install
npm start
```

Open <http://localhost:3000>. The Vercel project also needs the same environment
variables configured for production deployments.
