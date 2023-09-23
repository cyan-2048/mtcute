import { MtArgumentError } from '@mtcute/core'
import { tdFileId } from '@mtcute/file-id'
import { tl } from '@mtcute/tl'

import { TelegramClient } from '../../client'
import { InputFileLike, isUploadedFile } from '../../types'

/**
 * Normalize a {@link InputFileLike} to `InputFile`,
 * uploading it if needed.
 *
 * @internal
 */
export async function _normalizeInputFile(
    this: TelegramClient,
    input: InputFileLike,
    params: {
        progressCallback?: (uploaded: number, total: number) => void
        fileName?: string
        fileSize?: number
        fileMime?: string
    },
): Promise<tl.TypeInputFile> {
    if (typeof input === 'object' && tl.isAnyInputMedia(input)) {
        throw new MtArgumentError("InputFile can't be created from an InputMedia")
    } else if (tdFileId.isFileIdLike(input)) {
        if (typeof input === 'string' && input.match(/^file:/)) {
            const uploaded = await this.uploadFile({
                file: input.substring(5),
                ...params,
            })

            return uploaded.inputFile
        }
        throw new MtArgumentError("InputFile can't be created from an URL or a File ID")
    } else if (isUploadedFile(input)) {
        return input.inputFile
    } else if (typeof input === 'object' && tl.isAnyInputFile(input)) {
        return input
    } else {
        const uploaded = await this.uploadFile({
            file: input,
            ...params,
        })

        return uploaded.inputFile
    }
}
