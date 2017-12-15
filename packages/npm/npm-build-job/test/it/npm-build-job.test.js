'use strict'
const {promisify: p} = require('util')
const fs = require('fs')
const path = require('path')
const {describe, it, before, after} = require('mocha')
const {expect} = require('chai')
const {executeBuild} = require('@bilt/jobs')
const setup = require('./setup')
const npmBuildJobService = require('../..')
const findNextVersion = require('../../src/find-next-version')

describe('npm-build-job', function() {
  const {agentInstance, npmCommander, pimport, agent, npmCommanderSetup, setupPackage} = setup(
    before,
    after,
  )

  it('should build, test, and publish a package', async () => {
    const {dir, packageJson} = await setupPackage('this-package-not-in-npm-reg-a', {
      shouldPublish: true,
    })
    const builder = await npmBuildJobService({
      pimport: pimport(),
      config: {artifactDefaults: {publish: true}},
      plugins: [
        {
          fetchRepository: async () => ({
            directory: dir,
          }),
        },
        npmCommander(),
      ],
    })

    const job = {
      dependencies: [],
      artifacts: [],
      artifact: {path: ''},
      filesChangedSinceLastBuild: [],
    }

    await executeBuild({builder, agent: agent(), job})

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

    const builder = await npmBuildJobService({
      pimport: pimport(),
      config: {artifactDefaults: {publish: true}},
      plugins: [
        {
          fetchRepository: async () => ({
            directory: dir,
          }),
        },
        npmCommander(),
      ],
    })

    await executeBuild({
      builder,
      agent: agent(),
      job: {dependencies: [], artifacts: [], artifact: {path: ''}, filesChangedSinceLastBuild: []},
    })

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

  it('should enable overriding steps and artifact configs from artifactrc.yml', async () => {
    const {dir, packageJson} = await setupPackage('c-senior', {
      shouldPublish: false,
    })

    const builder = await npmBuildJobService({
      pimport: pimport(),
      config: {artifactDefaults: {publish: true}},
      plugins: [
        {
          fetchRepository: async () => ({
            directory: dir,
          }),
        },
        npmCommander(),
      ],
    })

    const artifact = {
      steps: [
        {id: 'install'},
        {id: 'build'},
        {id: 'groan', command: ['npm', 'run', 'groan'], condition: 'artifact.doGroan'},
        {
          id: 'sloan',
          command: ['npm', 'run', 'sloan-does-not-exist'],
          condition: 'packageJson.scripts.sloan',
        },
        {id: 'publish'},
      ],
      publish: false,
      doGroan: true,
    }

    await executeBuild({
      builder,
      agent: agent(),
      job: {
        dependencies: [],
        artifacts: [],
        artifact: {path: ''},
        filesChangedSinceLastBuild: [],
        artifact,
      },
    })

    expect(await p(fs.exists)(path.join(dir, 'installed'))).to.be.true
    expect(await p(fs.exists)(path.join(dir, 'tested'))).to.be.false
    expect(await p(fs.exists)(path.join(dir, 'groaned'))).to.be.true

    expect(
      await findNextVersion(
        agent(),
        agentInstance(),
        dir,
        packageJson,
        npmCommander(),
        npmCommanderSetup(),
      ),
    ).to.equal('29.12.2000')
  })
})
