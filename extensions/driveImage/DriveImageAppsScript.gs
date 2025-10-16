/**
 * Google Apps Script backend for the Drive image integration.
 *
 * Deploy this file as a Web App and provide the deployment URL to the
 * DriveImageExtension front-end. Requests are sent as text/plain to avoid CORS
 * preflight checks, so the body must be parsed manually.
 */

const DRIVE_IMAGE_FOLDER_PROPERTY = '1RiX0j4Dh33wQETm1OIjcXWuxcYd9xHx6';
const DEFAULT_UPLOAD_FOLDER_NAME = 'Image';
const ROOT_FOLDER_KEY = '__root__';

/**
 * Handles GET requests (e.g. gallery listing).
 * @param {GoogleAppsScript.Events.DoGet} e
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action || '').toString().toLowerCase();

  if (action === 'gallery') {
    const folders = listImageFolders({ includeImages: true });
    return createJsonOutput({ success: true, folders });
  }

  if (action === 'folders') {
    const folders = listImageFolders({ includeImages: false });
    return createJsonOutput({ success: true, folders });
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

  const rootFolder = getUploadFolder();
  const targetFolder = getOrCreateTargetFolder(rootFolder, data.folderName);
  const file = targetFolder.createFile(blob);

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
 * Lists image folders and optionally their images.
 * @param {{includeImages?: boolean}} options
 * @return {Array<Object>}
 */
function listImageFolders(options) {
  const includeImages = Boolean(options && options.includeImages);
  const rootFolder = getUploadFolder();
  const childFolders = rootFolder.getFolders();

  const childEntries = [];

  while (childFolders.hasNext()) {
    const folder = childFolders.next();
    const folderName = folder.getName();
    const images = includeImages ? listImagesInFolder(folder) : [];
    const imageCount = includeImages ? images.length : countImagesInFolder(folder);

    childEntries.push({
      id: folder.getId(),
      name: folderName,
      displayName: folderName,
      key: folderName,
      path: DEFAULT_UPLOAD_FOLDER_NAME + '/' + folderName,
      imageCount: imageCount,
      images: includeImages ? images : []
    });
  }

  childEntries.sort(function (a, b) {
    const aName = (a.displayName || '').toString();
    const bName = (b.displayName || '').toString();
    return aName.localeCompare(bName, 'ja');
  });

  const rootImages = includeImages ? listImagesInFolder(rootFolder) : [];
  const rootImageCount = includeImages ? rootImages.length : countImagesInFolder(rootFolder);

  return [{
    id: rootFolder.getId(),
    name: '',
    displayName: '未分類',
    key: ROOT_FOLDER_KEY,
    path: DEFAULT_UPLOAD_FOLDER_NAME,
    imageCount: rootImageCount,
    images: includeImages ? rootImages : []
  }].concat(childEntries);
}

function listImagesInFolder(folder) {
  const images = [];
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    if (!isImageMimeType(file.getMimeType())) {
      continue;
    }
    const id = file.getId();
    images.push({
      id: id,
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

function countImagesInFolder(folder) {
  let count = 0;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (isImageMimeType(file.getMimeType())) {
      count += 1;
    }
  }
  return count;
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

function sanitizeFolderName(name) {
  if (!name) {
    return '';
  }
  return name.toString().trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 128);
}

function getOrCreateTargetFolder(rootFolder, folderName) {
  const sanitized = sanitizeFolderName(folderName);
  if (!sanitized || sanitized === ROOT_FOLDER_KEY) {
    return rootFolder;
  }
  const existing = rootFolder.getFoldersByName(sanitized);
  if (existing.hasNext()) {
    return existing.next();
  }
  return rootFolder.createFolder(sanitized);
}

function isImageMimeType(mimeType) {
  if (!mimeType) {
    return false;
  }
  return mimeType.toString().toLowerCase().indexOf('image/') === 0;
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
