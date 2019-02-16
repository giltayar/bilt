'use strict'
const debug = require('debug')('bilt:in-memory-events')

/**
 * @type InMemoryEvents
 */
class InMemoryEvents {} //eslint-disable-line

/**
 * @returns {InMemoryEvents}
 */
async function makeEvents() {
  const ret = {subscribers: {}}

  return ret
}

/**
 * @param {InMemoryEvents} events
 * @param {string} eventCode
 * @param {(eventInfo: object) => Promise<void>} handler
 */
async function subscribe(events, eventCode, handler) {
  const {subscribers} = events

  debug('subscribing to %s', eventCode)
  subscribers[eventCode] = (subscribers[eventCode] || []).concat(handler)

  return async () => {
    debug('removing handler from %s', eventCode)
    subscribers[eventCode] = (subscribers[eventCode] || []).filter(h => h === handler)
  }
}

/**
 * @param {InMemoryEvents} events
 * @param {string} eventCode
 * @param {object} eventInfo
 */
async function publish(events, eventCode, eventInfo) {
  debug('publishing event %s with info %o', eventCode, eventInfo)
  const {subscribers} = events

  for (const subscriber of subscribers[eventCode] || []) {
    await subscriber(eventInfo)
  }
}

module.exports = {makeEvents, subscribe, publish}
