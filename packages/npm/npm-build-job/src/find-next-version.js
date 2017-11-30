'use strict'
const {calculateNextVersionPackage} = require('./version-calculations')

async function findNextVersion(
  agent,
  agentInstance,
  directory,
  packageJson,
  npmCommander,
  npmCommanderSetup,
) {
  const registryPackageinfo = await getRegistryPackageInfo(
    agent,
    agentInstance,
    directory,
    packageJson,
    npmCommander,
    npmCommanderSetup,
  )

  const registryVersions =
    registryPackageinfo === undefined ? [] : normalizeVersions(registryPackageinfo.versions)

  return calculateNextVersionPackage(packageJson.version, registryVersions)
}

async function getRegistryPackageInfo(
  agent,
  agentInstance,
  directory,
  packageJson,
  npmCommander,
  npmCommanderSetup,
) {
  const packageName = packageJson.name

  const output = await agent.executeCommand(
    npmCommander.transformAgentCommand(
      {
        agentInstance,
        command: ['npm', 'view', '--json', packageName],
        cwd: directory,
        returnOutput: true,
      },
      {setup: npmCommanderSetup},
    ),
  )

  if (output.includes('npm ERR! code E404')) return undefined
  else return JSON.parse(output)
}

function normalizeVersions(versions) {
  return (versions || []).concat(versions)
}

module.exports = findNextVersion
