import type { InputReplyKeyboardButton } from './types.js'
import { describe, expect, it } from 'vitest'

import { BotKeyboardBuilder } from './builder.js'

describe('BotKeyboardBuilder', () => {
  describe('#push', () => {
    it('should add buttons', () => {
      const builder = new BotKeyboardBuilder()

      builder.push(
        { type: 'disabled', text: '1' },
        { type: 'disabled', text: '2' },
        { type: 'disabled', text: '3' },
      )

      expect(builder.asInline()).toEqual({
        type: 'inline',
        buttons: [
          [
            { type: 'disabled', text: '1' },
            { type: 'disabled', text: '2' },
            { type: 'disabled', text: '3' },
          ],
        ],
      })
    })

    it('should wrap long rows buttons', () => {
      const builder = new BotKeyboardBuilder(3)

      builder.push(
        { type: 'disabled', text: '1' },
        { type: 'disabled', text: '2' },
        { type: 'disabled', text: '3' },
        { type: 'disabled', text: '4' },
      )

      expect(builder.asInline()).toEqual({
        type: 'inline',
        buttons: [
          [
            { type: 'disabled', text: '1' },
            { type: 'disabled', text: '2' },
            { type: 'disabled', text: '3' },
          ],
          [{ type: 'disabled', text: '4' }],
        ],
      })
    })

    it('should always add a new row', () => {
      const builder = new BotKeyboardBuilder(3)

      builder.push({ type: 'disabled', text: '1' })
      builder.push({ type: 'disabled', text: '2' })
      builder.push({ type: 'disabled', text: '3' })

      expect(builder.asInline()).toEqual({
        type: 'inline',
        buttons: [
          [{ type: 'disabled', text: '1' }],
          [{ type: 'disabled', text: '2' }],
          [{ type: 'disabled', text: '3' }],
        ],
      })
    })

    it('should accept functions and falsy values', () => {
      const builder = new BotKeyboardBuilder(3)

      builder.push({ type: 'disabled', text: '1' })
      builder.push(() => ({ type: 'disabled', text: '2' }))
      builder.push(0 > 1 && { type: 'disabled', text: '3' })

      expect(builder.asInline()).toEqual({
        type: 'inline',
        buttons: [[{ type: 'disabled', text: '1' }], [{ type: 'disabled', text: '2' }]],
      })
    })
  })

  describe('#append', () => {
    it('should append (or wrap) to the last row', () => {
      const builder = new BotKeyboardBuilder(3)

      builder.append({ type: 'disabled', text: '1' })
      builder.append({ type: 'disabled', text: '2' })
      builder.append({ type: 'disabled', text: '3' })
      builder.append({ type: 'disabled', text: '4' })

      expect(builder.asInline()).toEqual({
        type: 'inline',
        buttons: [
          [
            { type: 'disabled', text: '1' },
            { type: 'disabled', text: '2' },
            { type: 'disabled', text: '3' },
          ],
          [{ type: 'disabled', text: '4' }],
        ],
      })
    })

    it('accept functions and falsy values', () => {
      const builder = new BotKeyboardBuilder(3)

      builder.append({ type: 'disabled', text: '1' })
      builder.append(() => ({ type: 'disabled', text: '2' }))
      builder.append(0 > 1 && { type: 'disabled', text: '3' })

      expect(builder.asInline()).toEqual({
        type: 'inline',
        buttons: [
          [
            { type: 'disabled', text: '1' },
            { type: 'disabled', text: '2' },
          ],
        ],
      })
    })
  })

  it('should accept custom row size', () => {
    const builder = new BotKeyboardBuilder(5)

    builder.append({ type: 'disabled', text: '1' })
    builder.append({ type: 'disabled', text: '2' })
    builder.append({ type: 'disabled', text: '3' })
    builder.append({ type: 'disabled', text: '4' })
    builder.append({ type: 'disabled', text: '5' })
    builder.append({ type: 'disabled', text: '6' })

    expect(builder.asInline()).toEqual({
      type: 'inline',
      buttons: [
        [
          { type: 'disabled', text: '1' },
          { type: 'disabled', text: '2' },
          { type: 'disabled', text: '3' },
          { type: 'disabled', text: '4' },
          { type: 'disabled', text: '5' },
        ],
        [{ type: 'disabled', text: '6' }],
      ],
    })
  })

  it('#row should add entire rows of buttons', () => {
    const builder = new BotKeyboardBuilder(3)

    builder.row([
      { type: 'disabled', text: '1' },
      { type: 'disabled', text: '2' },
      { type: 'disabled', text: '3' },
      { type: 'disabled', text: '4' },
      { type: 'disabled', text: '5' },
    ])
    builder.append({ type: 'disabled', text: '6' })

    expect(builder.asInline()).toEqual({
      type: 'inline',
      buttons: [
        [
          { type: 'disabled', text: '1' },
          { type: 'disabled', text: '2' },
          { type: 'disabled', text: '3' },
          { type: 'disabled', text: '4' },
          { type: 'disabled', text: '5' },
        ],
        [{ type: 'disabled', text: '6' }],
      ],
    })
  })

  it('should support reply keyboards', () => {
    const builder = new BotKeyboardBuilder<InputReplyKeyboardButton>(3)

    builder.append({ type: 'text', text: '1' })
    builder.append({ type: 'text', text: '2' })
    builder.append({ type: 'text', text: '3' })
    builder.append({ type: 'text', text: '4' })

    expect(builder.asReply({ resize: true })).toEqual({
      type: 'reply',
      resize: true,
      buttons: [
        [
          { type: 'text', text: '1' },
          { type: 'text', text: '2' },
          { type: 'text', text: '3' },
        ],
        [{ type: 'text', text: '4' }],
      ],
    })
  })
})
