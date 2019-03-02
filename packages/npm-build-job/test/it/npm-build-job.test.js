'use strict'
const {promisify: p} = require('util')
const fs = require('fs')
const path = require('path')
const {describe, it, before, after} = require('mocha')
const {expect} = require('chai')
const {executeBuild} = require('@bilt/jobs')
const {npmNextVersion} = require('@bilt/npm-next-version')
const setup = require('./setup')
const npmBuildJobService = require('../..')

describe('npm-build-job', function() {
  const {setupPackage} = setup(before, after)

  it('should build, test, and publish a package in formal build mode', async () => {
    const {dir, packageJson} = await setupPackage('this-package-not-in-npm-reg-a', {
      shouldPublish: true,
    })

    const job = {
      dependencies: [],
      repositoryDirectory: dir,
      artifacts: [],
      artifact: {path: ''},
      filesChangedSinceLastBuild: [],
    }

    const {err} = await executeBuild({
      builder: npmBuildJobService,
      buildConfig: {isFormalBuild: true},
      job,
      repositoryDirectory: dir,
    })
    expect(err).to.be.undefined

    expect(await exists(path.join(dir, 'tested'))).to.be.true
    expect(await exists(path.join(dir, 'built'))).to.be.true

    expect(await npmNextVersion(packageJson)).to.equal('3.10.1969')
  })

  it('should test and publish a never-before-published package', async () => {
    const {dir, packageJson} = await setupPackage('this-package-not-in-npm-reg-b', {
      shouldPublish: false,
    })
    await executeBuild({
      builder: npmBuildJobService,
      buildConfig: {isFormalBuild: true},
      job: {
        dependencies: [],
        artifacts: [],
        repositoryDirectory: dir,
        artifact: {path: ''},
        filesChangedSinceLastBuild: [],
      },
      repositoryDirectory: dir,
    })

    expect(await exists(path.join(dir, 'tested'))).to.be.true

    expect(await npmNextVersion(packageJson)).to.equal('29.12.2001')
  })

  it('should enable overriding steps and artifact configs from artifactrc.yml', async () => {
    const {dir, packageJson} = await setupPackage('c-senior', {
      shouldPublish: false,
    })

    const artifact = {
      steps: [
        {id: 'install-ci'},
        {id: 'publish-bump-version'},
        {id: 'build'},
        {id: 'groan', command: ['npm', 'run', 'groan'], condition: 'artifact.doGroan'},
        {
          id: 'sloan',
          command: ['npm', 'run', 'sloan-does-not-exist'],
          condition: 'packageJson.scripts.sloan',
        },
      ],
      doGroan: true,
      path: '',
    }

    await executeBuild({
      buildConfig: {isFormalBuild: true},
      builder: npmBuildJobService,
      job: {
        repositoryDirectory: dir,
        dependencies: [],
        artifacts: [],
        artifact,
        filesChangedSinceLastBuild: undefined,
      },
      enableSteps: ['groan'],
      repositoryDirectory: dir,
    })

    expect(await exists(path.join(dir, 'installed'))).to.be.true
    expect(await exists(path.join(dir, 'tested'))).to.be.false
    expect(await exists(path.join(dir, 'groaned'))).to.be.true

    expect(await npmNextVersion(packageJson)).to.equal('29.12.2000')
  })
})

async function exists(filename) {
  return await p(fs.stat)(filename).then(() => true, () => false)
}
