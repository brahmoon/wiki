# Admin Authorization Endpoint

The `authorize.gs` web app exposes several admin-only actions. Each request should first hit `action=verifyAdminAccess` to confirm the operator's privileges.

## verifyAdminAccess Response

Successful responses contain the following fields in addition to the account metadata that already existed:

- `adminToken`: HMAC-SHA256 signed payload encoding the admin identity and expiry. Echo this token in the `adminToken` request field for subsequent privileged calls.
- `adminTokenExpiresAt`: ISO-8601 timestamp indicating when the token will expire. Renew the token by calling `verifyAdminAccess` again before this point.

Any admin action response (e.g., `updateAuthority`, `getToolbarPlugins`, or Drive image authority updates) mirrors these fields so the client can keep the short-lived session token fresh without another verification round trip.
