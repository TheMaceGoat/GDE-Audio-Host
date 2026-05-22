# GDE-Audio-Host

A small audio upload host for TurboWarp-style URL playback.

## What this does

This project provides a simple web page and backend that lets users:

- upload an audio file
- receive a direct file URL
- paste that URL into a TurboWarp audio extension or any player that accepts remote audio URLs

## How it works

- `public/index.html` is a small upload UI
- `server.js` receives file uploads with `multer`
- uploaded files are stored in `uploads/`
- files are served from `/uploads/<filename>` so the browser can access them directly

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

3. Open the app in your browser:

```text
http://localhost:3000
```

## How to use with TurboWarp

1. Upload the audio file using the page.
2. Copy the direct link shown after upload.
3. Paste that link into your TurboWarp extension or any URL-based playback block.

> The important part is the file URL must be publicly accessible from the browser.
>
> TurboWarp and modern browsers prefer `https://` URLs, so local `http://localhost:3000` may not work in the editor or extension.

## HTTPS via tunnel

For a quick HTTPS URL, use a tunnel service after starting the app:

```bash
npm start
npm run tunnel
```

Then use the returned `https://...` link with TurboWarp. If you want, you can also use `ngrok http 3000` instead.

## Deployment note

This example is a simple server-based upload host. For production, deploy to a public host or use a storage service such as AWS S3, DigitalOcean Spaces, or Firebase Storage.
