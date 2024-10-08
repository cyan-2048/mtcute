/* eslint-disable unused-imports/no-unused-vars */

import type { ITelegramClient } from '../../client.types.js'
import type { FileDownloadLocation, FileDownloadParameters } from '../../types/index.js'

// @available=both
/**
 * Download a remote file to a local file (only for Node.js).
 * Promise will resolve once the download is complete.
 *
 * @param filename  Local file name to which the remote file will be downloaded
 * @param params  File download parameters
 */
declare function downloadToFile(
    client: ITelegramClient,
    filename: string,
    location: FileDownloadLocation,
    params?: FileDownloadParameters,
): Promise<void>
