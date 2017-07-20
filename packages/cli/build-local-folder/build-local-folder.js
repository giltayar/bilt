'use strict'

const pluginRepoFactory = require('../../plugins/initial-dummy-plugin-repository')
const jobDispatcherFactory = require('../../jobs/job-dispatcher')
const eventsFactory = require('../../events/in-memory-events')
const hostAgentFactory = require('../../agents/host-agent')
const debug = require('debug')('bildit:build-local-folder')

const pluginRepository = pluginRepoFactory()
const events = eventsFactory()

const jobDispatcher = jobDispatcherFactory({pluginRepository, events})

const folder = process.argv[2]

const agentFunctions = hostAgentFactory({cwd: folder})

debug('building folder %s with npm build', folder)
jobDispatcher.dispatchJob({kind: 'npm'}, agentFunctions)
