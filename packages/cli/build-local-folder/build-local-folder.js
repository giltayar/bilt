'use strict'

const debug = require('debug')('bildit:build-local-folder')
const pluginRepoFactory = require('../../plugins/config-based-plugin-repository')
const path = require('path')
;(async () => {
  const folderToBuild = path.resolve(process.argv[2])

  const pluginRepository = await pluginRepoFactory({folderToBuild})

  const jobDispatcher = await pluginRepository.findPlugin({kind: 'jobDispatcher'})
  const agentFunctions = await pluginRepository.findPlugin({kind: 'agent', cwd: folderToBuild})

  debug('building folder %s with npm build', folderToBuild)
  await jobDispatcher.dispatchJob({kind: 'npm'}, agentFunctions)
})().catch(err => console.log(err.stack))
