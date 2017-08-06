'use strict'
const debug = require('debug')('bildit:leveldb-job-dispatcher')
const path = require('path')
const {promisify: p} = require('util')
const makeDir = require('make-dir')
const levelQueue = require('level-q')
const level = require('level')
const bytewise = require('bytewise')
const {runJob} = require('@bildit/jobs')

module.exports = async ({pluginRepository, events, directory}) => {
  const {queue, kvStoreDb} = await initializeDb()
  await listenAndExecuteJobs()

  const kvStore = {
    get: key =>
      p(kvStoreDb.get.bind(kvStoreDb))(key).catch(err => {
        if (err.type === 'NotFoundError') return undefined
        return Promise.reject(err)
      }),
    set: p(kvStoreDb.put.bind(kvStoreDb)),
  }

  return {
    dispatchJob,
  }

  async function dispatchJob(job, {awakenedFrom} = {}) {
    debug('dispatching job %o to queue', job)
    await p(queue.push)({job, awakenedFrom})
  }

  async function initializeDb() {
    await makeDir(path.join(directory, '.bildit'))

    const jobQueueDb = await p(level)(path.join(directory, '.bildit', 'job-queue'), {
      keyEncoding: bytewise,
      valueEncoding: 'json',
    })
    const kvStoreDb = await p(level)(path.join(directory, '.bildit', 'kv-store'), {
      keyEncoding: bytewise,
      valueEncoding: 'json',
    })

    const {queue} = levelQueue(jobQueueDb)

    return {queue, kvStoreDb}
  }

  async function listenAndExecuteJobs() {
    queue.listen(async (err, value, key, next) => {
      if (err) {
        console.log('Error listening on queue', err.stack)
        throw err
      }
      const {job, awakenedFrom} = value

      runJob(job, {awakenedFrom, pluginRepository, events, kvStore, dispatchJob}).catch(err =>
        console.error(err.stack),
      )

      next()
    })
  }
}
