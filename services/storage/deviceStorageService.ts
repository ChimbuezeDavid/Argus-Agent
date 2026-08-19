// Device Storage & File Operations Service for Argus Agent
// Indexes, searches, reads documents/receipts, and creates files on Android storage.
import ArgusSystemMonitors, { StorageFileItem, StorageDirectories } from '@/modules/argus-system-monitors';

export interface StorageStatus {
  hasPermission: boolean;
  directories: StorageDirectories;
}

export interface FileSearchResult {
  success: boolean;
  query: string;
  count: number;
  files: StorageFileItem[];
  message: string;
}

export interface FileReadResult {
  success: boolean;
  filePath: string;
  content: string;
  charCount: number;
  message: string;
}

export interface FileWriteResult {
  success: boolean;
  filePath: string;
  bytesWritten: number;
  message: string;
}

/**
 * Check if Argus has full device storage access permissions
 */
export async function checkStorageStatus(): Promise<StorageStatus> {
  try {
    const hasPermission = await ArgusSystemMonitors.hasStoragePermission();
    const directories = await ArgusSystemMonitors.getStorageDirectories();
    return { hasPermission, directories };
  } catch (e: any) {
    return {
      hasPermission: false,
      directories: {
        root: '/storage/emulated/0',
        downloads: '/storage/emulated/0/Download',
        documents: '/storage/emulated/0/Documents',
        dcim: '/storage/emulated/0/DCIM',
        pictures: '/storage/emulated/0/Pictures',
      },
    };
  }
}

/**
 * Open Android system settings to grant All Files Access
 */
export async function openAllFilesAccessSettings(): Promise<boolean> {
  return await ArgusSystemMonitors.openAllFilesAccessSettings();
}

/**
 * Search files across Downloads, Documents, or root storage by query and extension filter
 */
export async function searchDeviceStorage(
  query: string,
  options?: {
    rootPath?: string;
    extensionFilter?: string;
    maxResults?: number;
  }
): Promise<FileSearchResult> {
  const q = (query || '').trim();
  const max = options?.maxResults || 25;

  try {
    // 1. Get base search roots
    const dirs = await ArgusSystemMonitors.getStorageDirectories();
    const targetRoot = options?.rootPath || dirs.downloads;

    // 2. Perform native search
    let files = await ArgusSystemMonitors.searchFiles(q, targetRoot, max);

    // If search in Downloads returned empty, expand to Documents & Root
    if (files.length === 0 && !options?.rootPath) {
      const docFiles = await ArgusSystemMonitors.searchFiles(q, dirs.documents, max);
      files = docFiles;
    }

    // 3. Optional extension filter
    if (options?.extensionFilter) {
      const ext = options.extensionFilter.toLowerCase().replace('.', '');
      files = files.filter((f) => f.name.toLowerCase().endsWith(`.${ext}`));
    }

    return {
      success: true,
      query: q,
      count: files.length,
      files,
      message: files.length > 0
        ? `Found ${files.length} file(s) matching "${q}"`
        : `No files found matching "${q}" in storage`,
    };
  } catch (e: any) {
    return {
      success: false,
      query: q,
      count: 0,
      files: [],
      message: `Storage search error: ${e.message || e}`,
    };
  }
}

/**
 * Read the UTF-8 text content of a file from phone storage (e.g. txt, csv, md, json, log)
 */
export async function readStorageFile(filePath: string, maxBytes: number = 50000): Promise<FileReadResult> {
  if (!filePath || !filePath.trim()) {
    return {
      success: false,
      filePath: '',
      content: '',
      charCount: 0,
      message: 'File path cannot be empty',
    };
  }

  try {
    const rawContent = await ArgusSystemMonitors.readFileContent(filePath.trim(), maxBytes);
    if (!rawContent && rawContent.length === 0) {
      return {
        success: false,
        filePath,
        content: '',
        charCount: 0,
        message: `File at "${filePath}" is empty or could not be read`,
      };
    }

    return {
      success: true,
      filePath,
      content: rawContent,
      charCount: rawContent.length,
      message: `Successfully read ${rawContent.length} characters from "${filePath}"`,
    };
  } catch (e: any) {
    return {
      success: false,
      filePath,
      content: '',
      charCount: 0,
      message: `Failed to read file: ${e.message || e}`,
    };
  }
}

/**
 * Write or create a file on phone storage (defaults to /storage/emulated/0/Download/)
 */
export async function writeStorageFile(
  fileName: string,
  content: string,
  options?: {
    subDirectory?: 'downloads' | 'documents' | 'root';
    append?: boolean;
  }
): Promise<FileWriteResult> {
  try {
    const dirs = await ArgusSystemMonitors.getStorageDirectories();
    const sub = options?.subDirectory || 'downloads';
    const targetDir = sub === 'documents' ? dirs.documents : sub === 'root' ? dirs.root : dirs.downloads;
    
    // Ensure clean filename
    const sanitizedName = fileName.replace(/[/\\?%*:|"<>]/g, '_');
    const fullPath = `${targetDir}/${sanitizedName}`;

    const written = await ArgusSystemMonitors.writeFileContent(fullPath, content, options?.append || false);
    if (!written) {
      return {
        success: false,
        filePath: fullPath,
        bytesWritten: 0,
        message: `Failed to write file to "${fullPath}". Check storage permissions.`,
      };
    }

    return {
      success: true,
      filePath: fullPath,
      bytesWritten: content.length,
      message: `Successfully saved file to "${fullPath}" (${content.length} characters)`,
    };
  } catch (e: any) {
    return {
      success: false,
      filePath: fileName,
      bytesWritten: 0,
      message: `Error writing file: ${e.message || e}`,
    };
  }
}

/**
 * List files in standard device directories (Downloads, Documents, etc.)
 */
export async function listDirectoryFiles(
  directoryType: 'downloads' | 'documents' | 'dcim' | 'pictures' | 'custom',
  customPath?: string,
  extensionFilter?: string
): Promise<StorageFileItem[]> {
  try {
    const dirs = await ArgusSystemMonitors.getStorageDirectories();
    let targetPath = dirs.downloads;

    if (directoryType === 'documents') targetPath = dirs.documents;
    else if (directoryType === 'dcim') targetPath = dirs.dcim;
    else if (directoryType === 'pictures') targetPath = dirs.pictures;
    else if (directoryType === 'custom' && customPath) targetPath = customPath;

    return await ArgusSystemMonitors.listFiles(targetPath, extensionFilter, 2);
  } catch (e) {
    return [];
  }
}
