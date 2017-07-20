const pluginRepoFactory = require('../../plugins/initial-dummy-plugin-repository')
const jobDispatcherFactory = require('../../jobs/job-dispatcher')
const eventsFactory = require('../../events/in-memory-events')
const hostAgentFactory = require('../../agents/host-agent')

const pluginRepo = pluginRepoFactory()
const events = eventsFactory()

const jobDispatcher = jobDispatcherFactory(pluginRepo, events)

const agentFunctions = hostAgentFactory({cwd: process.argv[2]})

jobDispatcher.dispatchJob({kind: 'npm'}, agentFunctions)
