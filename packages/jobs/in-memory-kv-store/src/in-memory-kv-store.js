'use strict'

const debug = require('debug')('bildit:in-memory-kv-store')

module.exports = async () => {
  const kvStore = new Map()

  return {
    async get(key) {
      debug('getting value for key %s', key)

      return kvStore.get(key)
    },

    async set(key, value) {
      debug('setting valuefor %s to %o', key, value)

      kvStore.set(key, value)
    },
  }
}
