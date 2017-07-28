'use strict'

const debug = require('debug')('bildit:bildit-here')
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
    linkDependencies: true,
  })
})().catch(err => console.log(err.stack))
