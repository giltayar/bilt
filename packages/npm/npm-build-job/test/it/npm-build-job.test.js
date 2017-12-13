'use strict'
const {promisify: p} = require('util')
const fs = require('fs')
const path = require('path')
const {describe, it, before, after} = require('mocha')
const {expect} = require('chai')
const setup = require('./setup')

const npmBuildJobService = require('../..')
const findNextVersion = require('../../src/find-next-version')

const testSteps = [
  {
    id: 'install',
    name: 'Install',
    command: ['npm', 'install'],
  },
  {
    id: 'increment-version',
    name: 'Increment Package Version',
    command: ({nextVersion}) => [
      'npm',
      'version',
      '--no-git-tag-version',
      '--allow-same-version',
      nextVersion,
    ],
  },
  {
    id: 'build',
    name: 'Build',
    command: ['npm', 'run', 'build'],
    condition: ({packageJson}) => packageJson.scripts && packageJson.scripts.build,
  },
  {
    id: 'test',
    name: 'Test',
    command: ['npm', 'test'],
  },
  {
    id: 'publish',
    name: 'Publish',
    command: ({access}) => ['npm', 'publish', '--access', access],
  },
]

describe('npm-build-job', function() {
  const {agentInstance, npmCommander, pimport, agent, npmCommanderSetup, setupPackage} = setup(
    before,
    after,
  )

  it('should build, test, and publish a package', async () => {
    const {dir, packageJson} = await setupPackage('this-package-not-in-npm-reg-a', {
      shouldPublish: true,
    })
    const {setupBuildSteps, getBuildSteps} = await npmBuildJobService({
      pimport: pimport(),
      config: {publish: true, steps: testSteps},
      plugins: [
        {
          fetchRepository: async () => ({
            directory: dir,
          }),
        },
        npmCommander(),
      ],
    })

    const context = await setupBuildSteps({
      agentInstance: agentInstance(),
      job: {dependencies: [], artifacts: [], artifactPath: '', filesChangedSinceLastBuild: []},
    })

    const {buildSteps} = getBuildSteps(context)

    for (const step of buildSteps) {
      await agent().executeCommand(step)
    }

    expect(await p(fs.exists)(path.join(dir, 'tested'))).to.be.true
    expect(await p(fs.exists)(path.join(dir, 'built'))).to.be.true

    expect(
      await findNextVersion(
        agent(),
        agentInstance(),
        dir,
        packageJson,
        npmCommander(),
        npmCommanderSetup(),
      ),
    ).to.equal('3.10.1969')
  })

  it('should test and publish a never-before-published package', async () => {
    const {dir, packageJson} = await setupPackage('this-package-not-in-npm-reg-b', {
      shouldPublish: false,
    })

    const {setupBuildSteps, getBuildSteps} = await npmBuildJobService({
      pimport: pimport(),
      config: {publish: true, steps: testSteps},
      plugins: [
        {
          fetchRepository: async () => ({
            directory: dir,
          }),
        },
        npmCommander(),
      ],
    })

    const context = await setupBuildSteps({
      agentInstance: agentInstance(),
      job: {dependencies: [], artifacts: [], artifactPath: '', filesChangedSinceLastBuild: []},
    })

    const {buildSteps} = getBuildSteps(context)

    for (const step of buildSteps) {
      await agent().executeCommand(step)
    }

    expect(await p(fs.exists)(path.join(dir, 'tested'))).to.be.true

    expect(
      await findNextVersion(
        agent(),
        agentInstance(),
        dir,
        packageJson,
        npmCommander(),
        npmCommanderSetup(),
      ),
    ).to.equal('29.12.2001')
  })
})
