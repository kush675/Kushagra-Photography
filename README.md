# Kushagra — Photography

A monochrome photography portfolio for Kushagra, a BDes student in Communication Design. Built with system typography, smooth interactions, a full-resolution viewer and a private owner upload studio.

- Website: https://kushagra-photographic-studies.aquabow1.chatgpt.site
- Owner studio: https://kushagra-photographic-studies.aquabow1.chatgpt.site/admin
- Instagram: https://www.instagram.com/notsokushagra/
- Email: gangwarkushagra2007@gmail.com

## Hosting and access

The website is hosted by Sites on a Cloudflare Workers runtime. This GitHub repository stores the source. GitHub Pages alone cannot run the server authentication, upload endpoints or R2 storage this project needs; publishing a static copy would not provide the owner studio.

Public portfolio access and owner upload access are independent. `/api/session` reveals the upload option only to the signed-in owner. `/admin` and every write endpoint enforce authorization on the server. Hosted sign-in is provided by Sites/ChatGPT. There is no shared password or client-side secret.

The production runtime must supply `ADMIN_EMAIL` as a secret and an R2 binding named `BUCKET`. Neither secret values nor owner records belong in GitHub. The first verified matching owner establishes a stable per-Site account ID through a conditional R2 write; subsequent access uses that ID. Keep the existing R2 bucket across deployments. The Site configuration in `.openai/hosting.json` identifies the existing deployment and its storage binding; it is not a credential.

For another hosting provider, configure a trusted authentication gateway that supplies verified identity. Do not accept identity headers from arbitrary visitors. The included Sites authentication integration must be adapted before deploying elsewhere.

## Local development

Requires Node.js 22.13 or newer and npm.

```sh
npm run install:ci
npm run dev
```

The local development server uses port 5173. For an owner preview, set the `ADMIN_EMAIL` environment variable in an ignored `.dev.vars` file to the test identity supplied by the local Sites sign-in simulator. Local authentication and storage are separate from production.

```sh
npm run build
npm run start
node --experimental-strip-types --test tests/photo-service.test.mjs
```

Production publishing uses the Sites build and deployment workflow. Updating the repository by itself does not redeploy the live Site.

## Photography and uploads

The gallery includes six photographs. Responsive previews are separate from full-resolution viewing files. Portrait JPEGs are preserved unchanged; RAW photographs use native camera JPEG renditions; the HIF photograph uses a full-resolution 16-bit PNG rendering. Large viewing files are split into ordered binary parts and reconstructed by the viewer without recompression. Keep every part and its filename.

The owner studio accepts JPEG, PNG and WebP originals up to 80 MiB. Original bytes are stored unchanged in R2. A separate browser-generated gallery preview speeds up browsing. Published uploads persist across deployments and join the collection automatically. RAW/HEIF files should first be exported to JPEG, PNG or WebP. No download controls are provided.

## Project structure

- `content/portfolio.html`: portfolio page and contact links.
- `content/admin.html`: private studio HTML, served after authorization.
- `public/`: browser code, styling and initial photo assets.
- `lib/photo-service.ts`: owner checks, upload validation and R2 storage.
- `app/`: server route handlers.
- `tests/photo-service.test.mjs`: owner authorization and upload behavior checks.
- `.openai/hosting.json`: existing Site identity and `BUCKET` binding.

Local credentials, build output, runtime state, dependencies and test uploads are excluded from this source export. The original RAW/HIF camera files are retained separately and are not part of this repository.
