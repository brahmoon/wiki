/**
 * Google Apps Script backend for the Drive image integration.
 *
 * Deploy this file as a Web App and provide the deployment URL to the
 * DriveImageExtension front-end. Requests are sent as text/plain to avoid CORS
 * preflight checks, so the body must be parsed manually.
 */

const DRIVE_IMAGE_FOLDER_PROPERTY = '1RiX0j4Dh33wQETm1OIjcXWuxcYd9xHx6';
const DEFAULT_UPLOAD_FOLDER_NAME = 'Image';

/**
 * Handles GET requests (e.g. gallery listing).
 * @param {GoogleAppsScript.Events.DoGet} e
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action || '').toString().toLowerCase();

  if (action === 'gallery') {
    const images = listGalleryImages();
    return createJsonOutput({ success: true, images });
  }

  return createJsonOutput({
    success: false,
    error: 'Unsupported action',
    action
  });
}

/**
 * Handles POST requests for uploads and deletions.
 * @param {GoogleAppsScript.Events.DoPost} e
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  const data = parseRequestData(e);
  const rawMethod = data.method || data.action || '';
  const method = rawMethod.toString().toLowerCase();
  let result;

  switch (method) {
    case 'delete':
    case 'remove':
      result = handleDeleteRequest(data);
      break;
    case 'base64':
      result = handleBase64Upload(data);
      break;
    default:
      result = {
        success: false,
        error: 'Unsupported method',
        method: rawMethod
      };
      break;
  }

  return createJsonOutput(result);
}

/**
 * Parses the incoming request body (text/plain JSON) and merges it with query parameters.
 * @param {GoogleAppsScript.Events.DoPost|GoogleAppsScript.Events.DoGet} e
 * @return {Object}
 */
function parseRequestData(e) {
  const data = {};

  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function(key) {
      data[key] = e.parameter[key];
    });
  }

  if (e && e.postData && e.postData.contents) {
    try {
      const parsed = JSON.parse(e.postData.contents);
      Object.keys(parsed || {}).forEach(function(key) {
        data[key] = parsed[key];
      });
    } catch (error) {
      Logger.log('[DriveImage] Failed to parse request body: %s', error);
      data.rawBody = e.postData.contents;
    }
  }

  return data;
}

/**
 * Handles deletion requests.
 * @param {Object} data
 * @return {Object}
 */
function handleDeleteRequest(data) {
  const id = data.id || data.imageId || data.fileId;

  if (!id) {
    return {
      success: false,
      error: 'Missing Drive file ID'
    };
  }

  try {
    if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.remove) {
      Drive.Files.remove(id);
    } else {
      DriveApp.getFileById(id).setTrashed(true);
    }

    return {
      success: true,
      id
    };
  } catch (error) {
    Logger.log('[DriveImage] Failed to delete file %s: %s', id, error);
    return {
      success: false,
      error: error && error.message ? error.message : 'Failed to delete file',
      id
    };
  }
}

/**
 * Handles base64 uploads used by the DriveImageHandler.
 * @param {Object} data
 * @return {Object}
 */
function handleBase64Upload(data) {
  if (!data || !data.file) {
    return {
      success: false,
      error: 'Missing file contents'
    };
  }

  const mimeType = data.mimetype || 'application/octet-stream';
  const fileName = data.filename || ('upload_' + Date.now());
  const base64Payload = data.file.indexOf(',') > -1 ? data.file.split(',').pop() : data.file;

  let blob;
  try {
    blob = Utilities.newBlob(Utilities.base64Decode(base64Payload), mimeType, fileName);
  } catch (error) {
    Logger.log('[DriveImage] Failed to decode base64 payload: %s', error);
    return {
      success: false,
      error: 'Invalid base64 payload'
    };
  }

  const folder = getUploadFolder();
  const file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (error) {
    Logger.log('[DriveImage] Failed to set sharing for %s: %s', file.getId(), error);
  }

  const fileId = file.getId();
  const response = {
    success: true,
    driveId: fileId,
    driveUrl: 'https://drive.google.com/uc?export=view&id=' + fileId,
    thumbnail: getThumbnailUrl(fileId),
    method: data.method || 'base64',
    fileName: file.getName(),
    mimeType: file.getMimeType(),
    size: file.getSize(),
    createdAt: file.getDateCreated().toISOString(),
    updatedAt: file.getLastUpdated().toISOString()
  };

  if (data.uploadId) {
    response.uploadId = data.uploadId;
  }

  return response;
}

/**
 * Lists the available images for the gallery action.
 * @return {Array<Object>}
 */
function listGalleryImages() {
  const folder = getUploadFolder();
  const files = folder.getFiles();
  const images = [];

  while (files.hasNext()) {
    const file = files.next();
    const id = file.getId();

    images.push({
      id,
      name: file.getName(),
      mimeType: file.getMimeType(),
      size: file.getSize(),
      url: 'https://drive.google.com/uc?export=view&id=' + id,
      thumbnail: getThumbnailUrl(id),
      createdAt: file.getDateCreated().toISOString(),
      updatedAt: file.getLastUpdated().toISOString()
    });
  }

  return images;
}

/**
 * Retrieves the upload folder, falling back to a dedicated folder in the root drive.
 * @return {GoogleAppsScript.Drive.Folder}
 */
function getUploadFolder() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty(DRIVE_IMAGE_FOLDER_PROPERTY);

  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (error) {
      Logger.log('[DriveImage] Configured folder %s is not accessible: %s', folderId, error);
    }
  }

  const root = DriveApp.getRootFolder();
  const existing = root.getFoldersByName(DEFAULT_UPLOAD_FOLDER_NAME);
  if (existing.hasNext()) {
    return existing.next();
  }

  return root.createFolder(DEFAULT_UPLOAD_FOLDER_NAME);
}

/**
 * Attempts to fetch a high-quality thumbnail URL for a Drive file.
 * @param {string} fileId
 * @return {string}
 */
function getThumbnailUrl(fileId) {
  if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.get) {
    try {
      const driveFile = Drive.Files.get(fileId, { fields: 'thumbnailLink' });
      if (driveFile && driveFile.thumbnailLink) {
        return driveFile.thumbnailLink.replace(/=s\d+$/i, '=s800');
      }
    } catch (error) {
      Logger.log('[DriveImage] Failed to fetch thumbnail for %s: %s', fileId, error);
    }
  }

  return 'https://drive.google.com/thumbnail?sz=w800&id=' + fileId;
}

/**
 * Creates a JSON response.
 * @param {Object} payload
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function createJsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload || {}))
    .setMimeType(ContentService.MimeType.JSON);
}
