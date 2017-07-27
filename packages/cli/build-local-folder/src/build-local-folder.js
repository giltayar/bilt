'use strict'

const debug = require('debug')('bildit:build-local-folder')
const pluginRepoFactory = require('../../../plugins/config-based-plugin-repository')
const path = require('path')
;(async () => {
  const folderToBuild = path.resolve(process.argv[2])

  const pluginRepository = await pluginRepoFactory(folderToBuild, {})

  const jobDispatcher = await pluginRepository.findPlugin({kind: 'jobDispatcher'})

  debug('building folder %s', folderToBuild)
  await jobDispatcher.dispatchJob({
    kind: 'repository',
    repository: folderToBuild,
    directory: folderToBuild,
  })
})().catch(err => console.log(err.stack))
