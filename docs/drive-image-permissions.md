# Drive Image Permissions Overview

This document summarizes the folder-based Drive image gallery and authority configuration that powers the wiki editor.

## Folder Hierarchy

Images are organized under the `Image` parent folder on Google Drive. Each direct child folder becomes an individual gallery category that can be browsed inside the editor:

```
Image/
├─ (root) – files without a child folder appear in the "未分類" category
├─ Events/
├─ Projects/
└─ ...
```

The backend returns this hierarchy via the `action=gallery` and `action=folders` endpoints exposed by `extensions/driveImage/DriveImageAppsScript.gs`. Each folder response includes:

- `key`: Unique identifier (folder name or `__root__` for the root bucket)
- `displayName`: Folder label used in the UI
- `imageCount`: Number of image files directly under the folder
- `images`: Optional array of file metadata for gallery rendering (only for `action=gallery`)

Uploads target either the root bucket (`__root__`) or a specific child folder. Folder keys are sanitized server-side, and missing directories are created automatically when a new image is uploaded.

## Permission Model

Drive image permissions are stored inside the `Authorities` sheet of the shared spreadsheet (managed by `authorize.gs`). Permissions are scoped to the Drive image feature under the `Image` type and are tracked per folder key and per role (`Editor`, `Moderator`).

For each folder, two boolean flags are stored:

- `canUpload`: Grants the ability to upload new images into the folder.
- `canDelete`: Allows removal of images from the folder (folders themselves cannot be deleted).

The editor runtime requests permissions through the `getDriveImagePermissions` action, caching results according to the `permissionCacheTimeout` option supplied to the `DriveImageExtension`.

## Admin Workflow

1. Administrators visit the 権限管理 page (`setting.html?page=authority`).
2. The UI fetches the current folder catalog (`action=folders`) and existing authorities via the authorization endpoint. Each request includes the administrator’s Google account email and the short-lived `adminToken` issued during login (see `docs/admin-auth.md`).
3. Admins select either the **Editor** or **Moderator** role, then toggle upload/delete checkboxes per folder.
4. Clicking **保存** sends an `updateDriveImageAuthorities` request. The Apps Script validates admin access, writes the data to the `Authorities` sheet, and returns the normalized record set alongside a refreshed `adminToken`.
5. On success, the UI refreshes the in-memory state, persists the updated admin session, and displays confirmation.

## Editor Experience

Within `edit.html`, the Drive image modal surfaces folder categories in the gallery. Upload controls include a destination picker that lists only folders the current user can write to. Deletion buttons respect the role’s `canDelete` flags. Permission refreshes can be triggered manually if admin settings change during a session.

## Deployment Notes

- Deploy both `authorize.gs` and `extensions/driveImage/DriveImageAppsScript.gs` as updated Apps Script web apps after making changes.
- Ensure the front-end constants that reference these endpoints (`ADMIN_AUTH_ENDPOINT`, `DRIVE_IMAGE_APPS_SCRIPT_ENDPOINT`) point to the correct deployment URLs.
- When testing locally, remember that permission caches are time-based; adjust the TTL via `permissionCacheTimeout` if necessary to reflect recent changes immediately.
