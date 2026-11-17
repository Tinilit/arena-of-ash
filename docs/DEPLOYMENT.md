# Public playtesting with GitHub Pages

The game is a static site: deployment needs no backend, accounts, or app secrets. GitHub Pages can serve the production bundle at a stable HTTPS URL and automatically replace it after validated updates to `main`.

## One-time GitHub setting

In the `Tinilit/arena-of-ash` repository, open **Settings → Pages → Build and deployment → Source**, and choose **GitHub Actions**. This setting requires repository administration access. Private-repository Pages availability depends on the repository owner's GitHub plan; do not make the source repository public just to enable hosting. The game site itself is intended to be public.

The management API equivalent is `POST /repos/Tinilit/arena-of-ash/pages` with `{ "build_type": "workflow" }` when no site exists, or updating an existing site's build type. Use existing GitHub authentication and preserve any custom-domain settings.

The expected address, once GitHub confirms deployment, is `https://tinilit.github.io/arena-of-ash/`. It is not considered live until a deployment succeeds and the page is checked.

## Update loop

Push a code update to `main`. The **Validate and deploy game** workflow runs strict type checking, lint, unit tests, a production build, and Chromium browser tests. Only a successful test job permits deployment. The deploy job builds with the `/arena-of-ash/` Vite base path, uploads only `dist/`, and publishes using GitHub's Pages actions. Pull requests are tested without deploying. **Actions → Validate and deploy game → Run workflow** can retry after the one-time Pages setting is enabled.

The existing public site stays on its last successful deployment if validation fails. Screenshots and failure traces are available from the workflow artifacts. The deploy job's environment URL is authoritative, especially if a custom domain is configured later.

Local smoke check for the same subdirectory build:

```sh
npm run build -- --base=/arena-of-ash/
npm run preview -- --port 4174 --base=/arena-of-ash/
```

Open `/arena-of-ash/` on that local preview server. Verify the menu, battle, and shop, and check that JavaScript requests resolve below `/arena-of-ash/assets/`. The regular `npm run build` and development server retain their root-path behavior.

## Playtest saves and updates

A browser keeps saves for the site's origin in localStorage. Future deployments preserve saves if the schema stays compatible. The public site and cloud development server have separate saves. Refresh to load a deployed update; there is no service worker or offline cache to hold an old version. No playtest data is sent to a backend.

## Managed cloud access

The cloud environment needs `api.github.com` to inspect deployment runs and configure Pages, plus `tinilit.github.io` to verify the deployed game. These domains have been added to the environment configuration draft; saving that draft does not apply the grants to a running task. Existing Git authentication is already usable, so no new token should be requested merely because the management API is blocked by policy.

## Runtime content updates

Item JSON and artwork under `public/content/**` are fetched separately from main by the published game. Content-only changes run the content validation workflow and skip the game build and Pages deployment. Publish the files, bump the catalog revision and refresh the page. See [runtime content](RUNTIME_CONTENT.md). This route requires public read access to those repository files; no database or application secrets are used.
