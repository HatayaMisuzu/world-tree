# World Tree Official Content Pipeline

This directory is for reviewable, redistributable content packs only.

Rules:

- Every pack must declare a manifest before publication.
- Licenses and authors must be explicit.
- Source material must be original, licensed, or user-provided with permission.
- Private runtime files, usage logs, debug logs, secrets, and hidden truth not meant for players must not be shipped.
- `.wtpack` exports use `manifest.specVersion: 1` with checksums for every included file.

Publication states:

- `draft`: local work only, not published.
- `review`: content and license review required.
- `approved`: ready to export as `.wtpack`.
- `blocked`: missing rights, safety review, or validation evidence.
