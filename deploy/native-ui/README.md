# Managed pipeline views in the native Twenty picker

The app still uses Twenty's kanban, view picker, dropdown, cards and side panel. Twenty v2.50.1 does not expose a per-view edit/delete lock to apps. Its native picker shows those actions whenever the current user has `VIEWS` permission, including for app-owned views.

This small host adaptation hides **Edit** and **Delete** in `ViewPickerOptionDropdown` for native KANBAN views whose `icon` is `IconLock`. That icon is the app's managed-board marker. Favorites, selection, native filters and other view types retain their original behavior. Pipeline names and columns are maintained from pipeline/stage records. This is a menu protection, not a server authorization rule: authorized administrators can still manage view metadata through the API. Reserve the lock icon for managed pipeline boards.

`twenty-v2.50.1.patch` contains the equivalent source change against upstream commit `1dccdfc5ad33bf11015064380e78eddcf0e69340` (`twenty/v2.50.1`). When building a full Twenty fork, apply this source patch before compiling its frontend.

The Railway wrapper uses the already compiled, digest-pinned official image. `apply.mjs` applies the same one-expression change to its native picker bundle. It checks the exact upstream SHA-256 and unique expected code before changing any file. Unsupported releases fail the image build. All JavaScript/CSS URLs and their import references receive a revision suffix to prevent browsers from reusing an older cached picker. An installation receipt makes reapplication idempotent. No script is injected into the browser and no CSS hides DOM elements.

Local development (after applying the app):

```sh
yarn configure:native-sales --boards-only
yarn configure:native-host
```

The second command backs up the frontend inside `.twenty/backups/native-ui/`, applies the patch to `twenty-app-dev`, and restarts that container because Twenty caches its HTML at startup. Wait for `/healthz`, then refresh the browser. Pass a different local container name as an argument if needed. Repeat after recreating the Docker development container. A normal app sync cannot install this host change.

Railway applies the adaptation during the server/worker image build; no manual container modification is required. The frontend adaptation must be reviewed, tested and updated explicitly before changing the pinned Twenty release. To roll back locally, restore the backed-up `front/` directory and restart the container; on Railway, redeploy the previous image. Database schema and records are unaffected.
