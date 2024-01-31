import { describe } from 'vitest'

import { testPeersRepository } from '../../../highlevel/storage/repository/peers.test-utils.js'
import { testRefMessagesRepository } from '../../../highlevel/storage/repository/ref-messages.test-utils.js'
import { testAuthKeysRepository } from '../../repository/auth-keys.test-utils.js'
import { testKeyValueRepository } from '../../repository/key-value.test-utils.js'
import { MemoryStorage } from './index.js'

describe('memory storage', () => {
    const storage = new MemoryStorage()

    testAuthKeysRepository(storage.authKeys)
    testKeyValueRepository(storage.kv, storage.driver)
    testPeersRepository(storage.peers, storage.driver)
    testRefMessagesRepository(storage.refMessages, storage.driver)
})
