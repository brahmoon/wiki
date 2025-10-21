# Admin Authentication Flow

## Overview
The Apps Script endpoints exposed by `authorize.gs` and `user-setting.gs` now enforce
administrator privileges exclusively on the server. Access is granted only when the
request can be matched to a Google account email stored in the `Accounts` sheet with
an authority value of **99 or higher**. The email check ensures that tampered
front-end payloads cannot impersonate another user.

All privileged responses include a short-lived admin session token that must be
sent back with subsequent requests. Clients that omit the Google email or present
an invalid token receive an error with `requiresReauthentication: true` and no
spreadsheet data.

## Admin Tokens
* Tokens are signed with an HMAC secret that is generated automatically and stored
  in Script Properties under `ADMIN_TOKEN_SECRET`.
* Each token contains the normalized account email, optional profile metadata, and
  timestamps. Tokens expire five minutes after issuance.
* The Apps Script backend rotates the token on every successful admin request and
  includes the following fields in the JSON response:
  - `adminToken`
  - `adminTokenIssuedAt`
  - `adminTokenExpiresAt`
  - `adminAuthority` (mirrors the verified numeric authority)

If the backend detects an expired, mismatched, or tampered token, the request is
rejected with `success: false` and `requiresReauthentication: true` so clients can
force a fresh login.

## Front-End Responsibilities
* Always include the Google account email (`googleEmail`) alongside the user email
  and, when available, the latest `adminToken` in every request to `authorize.gs`
  and `user-setting.gs`.
* Persist the admin token in `localStorage` (the token is stored under the
  `adminSession` key in `wikiLoginState`) so follow-up requests—even after a page
  refresh—can continue the verified session without prompting the user.
* Clear the cached admin session and redirect the user to authenticate again when
  an API response sets `requiresReauthentication: true`.

## Drive Image and Toolbar Integrations
Administrator actions exposed through `setting.html` (toolbar plugin management,
Drive image authority updates, and member listings) use the admin token to
validate permissions before any sheet data is returned. The front-end reuses the
same token exchange for all admin workflows, so adding a new privileged action
only requires calling `buildAdminRequestPayload` and `processAdminResult` in the
settings console scripts.
