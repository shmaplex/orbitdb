// @ts-check
/**
 * @module OrbitDB
 * @description
 * Main OrbitDB export barrel file with inline JSDoc types for full TypeScript inference.
 */

/**
 * @typedef {import('./orbitdb.js').createOrbitDB} createOrbitDB
 * @typedef {import('./databases/index.js').Documents} Documents
 * @typedef {import('./databases/index.js').Events} Events
 * @typedef {import('./databases/index.js').KeyValue} KeyValue
 * @typedef {import('./databases/index.js').KeyValueIndexed} KeyValueIndexed
 * @typedef {import('./databases/index.js').useDatabaseType} useDatabaseType
 * @typedef {import('./address.js').isValidAddress} isValidAddress
 * @typedef {import('./address.js').parseAddress} parseAddress
 * @typedef {import('./oplog/index.js').Log} Log
 * @typedef {import('./oplog/index.js').Entry} Entry
 * @typedef {import('./oplog/index.js').DefaultAccessController} DefaultAccessController
 * @typedef {import('./database.js').Database} Database
 * @typedef {import('./key-store.js').KeyStore} KeyStore
 * @typedef {import('./access-controllers/index.js').useAccessController} useAccessController
 * @typedef {import('./access-controllers/index.js').IPFSAccessController} IPFSAccessController
 * @typedef {import('./access-controllers/index.js').OrbitDBAccessController} OrbitDBAccessController
 * @typedef {import('./identities/index.js').Identities} Identities
 * @typedef {import('./identities/index.js').isIdentity} isIdentity
 * @typedef {import('./identities/index.js').useIdentityProvider} useIdentityProvider
 * @typedef {import('./identities/index.js').PublicKeyIdentityProvider} PublicKeyIdentityProvider
 * @typedef {import('./storage/index.js').IPFSBlockStorage} IPFSBlockStorage
 * @typedef {import('./storage/index.js').LevelStorage} LevelStorage
 * @typedef {import('./storage/index.js').LRUStorage} LRUStorage
 * @typedef {import('./storage/index.js').MemoryStorage} MemoryStorage
 * @typedef {import('./storage/index.js').ComposedStorage} ComposedStorage
 */

export { default as createOrbitDB } from './orbitdb.js'

export {
  Documents,
  Events,
  KeyValue,
  KeyValueIndexed,
  useDatabaseType
} from './databases/index.js'

export {
  isValidAddress,
  parseAddress
} from './address.js'

export {
  Log,
  Entry,
  DefaultAccessController
} from './oplog/index.js'

export { default as Database } from './database.js'

export { default as KeyStore } from './key-store.js'

export {
  useAccessController,
  IPFSAccessController,
  OrbitDBAccessController
} from './access-controllers/index.js'

export {
  Identities,
  isIdentity,
  useIdentityProvider,
  PublicKeyIdentityProvider
} from './identities/index.js'

export {
  IPFSBlockStorage,
  LevelStorage,
  LRUStorage,
  MemoryStorage,
  ComposedStorage
} from './storage/index.js'
