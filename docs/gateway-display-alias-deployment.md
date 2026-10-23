# Deploy and verify YiBai display aliases

The model names in the embedded video player and detail dialog are rendered by
the **gateway** container (`harson-pg-gateway`, port 3001). Merging a PR into
`temp-main` and rebuilding the `app` container alone will not update the
gateway's copy of `public/harson-customization/image-tab-labels.js`.

`gateway` has a Compose profile. The usual `docker compose up -d --build`
without `--profile gateway` skips this service, even if it is already running.
Both services use the `harson-pg:latest` image tag, but an existing gateway
container keeps running its old image until it is recreated.

## Current incident (15 October 2026)

The live `https://ai.harson-base.com/__harson_custom/image-tab-1/image-tab-labels.js`
response was 13,646 bytes, last modified at 11:45 UTC. It did not contain
`collectVideoMetadata`. The merged `temp-main` file has Git blob SHA
`7ec1a5b9bccc910f4e9e5f8c843a8f6f5862b5d5` and contains that function.
The live player and dialog have the original text because the old adapter is
still being served, while other aliases from the earlier adapter work.

## Update the gateway

1. Make sure the **server source directory** `/var/www/harson-pg` contains the
   merged `temp-main` files. If you deploy by rsync, sync your checked-out
   `temp-main` to that directory while preserving the existing `.env` and
   `data/` exclusions. A GitHub merge does not itself replace files on the
   server.

2. On the server, check the source file, then rebuild and recreate only the
   gateway container:

   ```sh
   cd /var/www/harson-pg
   grep -n 'collectVideoMetadata' public/harson-customization/image-tab-labels.js
   docker compose --profile gateway up -d --build --no-deps --force-recreate gateway
   docker compose --profile gateway ps gateway
   docker exec harson-pg-gateway grep -n 'collectVideoMetadata' /app/public/harson-customization/image-tab-labels.js
   ```

   Stop before the rebuild if the first `grep` finds nothing: the server source
   is still old. Update it from `temp-main` first. This command does not remove
   volumes or restart MongoDB.

3. Compare the container's public asset with the gateway response and the
   externally served response:

   ```sh
   cd /var/www/harson-pg
   curl -fsS http://127.0.0.1:3001/__harson_custom/image-tab-1/image-tab-labels.js -o /tmp/harson-alias-local.js
   curl -fsS https://ai.harson-base.com/__harson_custom/image-tab-1/image-tab-labels.js -o /tmp/harson-alias-public.js
   sha256sum public/harson-customization/image-tab-labels.js /tmp/harson-alias-local.js /tmp/harson-alias-public.js
   cmp public/harson-customization/image-tab-labels.js /tmp/harson-alias-local.js
   cmp /tmp/harson-alias-local.js /tmp/harson-alias-public.js
   ```

   All three SHA-256 values must match. If the host file is current but the
   container file is old, inspect the gateway rebuild. If the local gateway
   response is current but the public response is old, inspect the Nginx
   upstream/cache for `ai.harson-base.com` and any other gateway instance.

4. Reload the Harson workspace and inspect an existing video. The player badge
   should display `CLVideo3.0 原生 720p`; clicking it should display
   `CLVideo3.0(CLVideo3.0 原生 720p)` in the dialog. The original Seedance model
   name remains in provider data and request payloads. Do not start a paid
   generation merely to verify this display change.

The gateway currently serves these assets with `Cache-Control: public,
max-age=0`. A hard refresh cannot fix an older file inside the running
gateway container. Do not use `docker compose down -v` to update aliases.
