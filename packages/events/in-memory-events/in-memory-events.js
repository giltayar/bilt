'use strict'
const debug = require('debug')('bildit:in-memory-events')

module.exports = () => {
  const subscribers = {}

  return {
    async subscribe(eventCode, handler) {
      debug('subscribing to %s', eventCode)
      subscribers[eventCode] = (subscribers[eventCode] || []).concat(handler)

      return async () => {
        debug('removing handler from %s', eventCode)
        subscribers[eventCode] = (subscribers[eventCode] || []).filter(h => h === handler)
      }
    },
    async publish(eventCode, eventInfo) {
      debug('publishing event %s with info %o', eventCode, eventInfo)

      for (const subscriber of subscribers[eventCode] || []) {
        subscriber(eventInfo)
      }
    },
  }
}
