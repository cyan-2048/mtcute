import { hex } from '@fuman/utils'
import Long from 'long'
import { describe, expect, it } from 'vitest'
import { deserializeObjectWithCompat } from './compat.js'

describe('binary/compat', () => {
  it('should correctly read emojiStatus from layer 197', () => {
    const data = hex.decode('9d619b920000000000000000')
    expect(deserializeObjectWithCompat(data)).toEqual({
      _: 'emojiStatus',
      documentId: Long.ZERO,
    })
  })

  it('should correctly read emojiStatus from layer 198', () => {
    const data = hex.decode('8a06ffe7000000000000000000000000')
    expect(deserializeObjectWithCompat(data)).toEqual({
      _: 'emojiStatus',
      documentId: Long.ZERO,
    })
  })

  it('should correctly read inline keyboard from layer 228', () => {
    const data = hex.decode(
      '5402a348' // replyInlineMarkup_layer228
      + '15c4b51c01000000' // vector, 1 item
      + '838b6077' // keyboardButtonRow
      + '15c4b51c01000000' // vector, 1 item
      + 'ec250cd8' // keyboardButtonUrl_layer228
      + '00000000' // flags
      + '01610000' // text = 'a'
      + '01620000', // url = 'b'
    )
    expect(deserializeObjectWithCompat(data)).toEqual({
      _: 'replyInlineMarkup',
      rows: [
        {
          _: 'keyboardInlineButtonRow',
          buttons: [
            {
              _: 'keyboardInlineButton',
              text: 'a',
              type: { _: 'inlineButtonTypeUrl', url: 'b' },
            },
          ],
        },
      ],
    })
  })

  it('should correctly read reply keyboard buttons from layer 228', () => {
    const data = hex.decode(
      '838b6077' // keyboardButtonRow
      + '15c4b51c01000000' // vector, 1 item
      + 'ff0c177d' // keyboardButton_layer228
      + '00000000' // flags
      + '01610000', // text = 'a'
    )
    expect(deserializeObjectWithCompat(data)).toEqual({
      _: 'keyboardButtonRow',
      buttons: [
        {
          _: 'keyboardButton',
          text: 'a',
          type: { _: 'buttonTypeDefault' },
        },
      ],
    })
  })

  it('should correctly read emojiStatus from 197 inside channelAdminLogEventActionChangeEmojiStatus', () => {
    // rather unlikely case where emojiStatus from different layers is inside the same object.
    // still useful to test it tho
    const data = hex.decode('b1fea93e9d619b9200000000000000008a06ffe7000000000000000000000000')
    expect(deserializeObjectWithCompat(data)).toEqual({
      _: 'channelAdminLogEventActionChangeEmojiStatus',
      prevValue: {
        _: 'emojiStatus',
        documentId: Long.ZERO,
      },
      newValue: {
        _: 'emojiStatus',
        documentId: Long.ZERO,
      },
    })
  })
})
