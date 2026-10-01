// export const DOCUMENT_ARCHIVE_UPLOAD_CONFIG = {
//   maxFileBytes: 10 * 1024 * 1024,
//   maxRequestBytes: 50 * 1024 * 1024,
//   allowedExtensions: [
//     "pdf",
//     "jpg",
//     "jpeg",
//     "png",
//     "doc",
//     "docx",
//     "xls",
//     "xlsx",
//     "txt",
//     "csv",
//     "zip",
//   ],
//   allowedContentTypes: [
//     "application/pdf",
//     "image/jpeg",
//     "image/png",
//     "application/msword",
//     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//     "application/vnd.ms-excel",
//     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//     "text/plain",
//     "text/csv",
//     "application/zip",
//     "application/x-zip-compressed",
//   ],
// };

// export function maxFileSizeLabel() {
//   return `${Math.round(DOCUMENT_ARCHIVE_UPLOAD_CONFIG.maxFileBytes / 1024 / 1024)} MB`;
// }

// export function maxRequestSizeLabel() {
//   return `${Math.round(DOCUMENT_ARCHIVE_UPLOAD_CONFIG.maxRequestBytes / 1024 / 1024)} MB`;
// }


export const DOCUMENT_ARCHIVE_UPLOAD_CONFIG = {
  maxFileBytes: 10 * 1024 * 1024,
  maxRequestBytes: 50 * 1024 * 1024,
  // Empty means every file extension is accepted.
  allowedExtensions: [],

  // Empty means every browser-reported MIME type is accepted.
  allowedContentTypes: [],

};

export function maxFileSizeLabel() {
  return `${Math.round(DOCUMENT_ARCHIVE_UPLOAD_CONFIG.maxFileBytes / 1024 / 1024)} MB`;
}

export function maxRequestSizeLabel() {
  return `${Math.round(DOCUMENT_ARCHIVE_UPLOAD_CONFIG.maxRequestBytes / 1024 / 1024)} MB`;
}
