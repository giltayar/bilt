'use strict'
const {promisify: p} = require('util')
const fs = require('fs')
const path = require('path')
const {describe, it, before, after} = require('mocha')
const {expect} = require('chai')
const setup = require('./setup')

const npmBuildJobService = require('../..')
const findNextVersion = require('../../src/find-next-version')

describe.only('npm-build-job', function() {
  const {agentInstance, npmCommander, pimport, agent, dir, packageJson, npmCommanderSetup} = setup(
    before,
    after,
  )

  it('should build, test, and publish a package', async () => {
    const {setupBuildSteps, getBuildSteps} = await npmBuildJobService({
      pimport: pimport(),
      config: {publish: true},
      appConfig: {publish: true},
      plugins: [
        {
          fetchRepository: async () => ({
            directory: dir(),
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

    expect(await p(fs.exists)(path.join(dir(), 'tested'))).to.be.true
    expect(await p(fs.exists)(path.join(dir(), 'built'))).to.be.true

    expect(
      await findNextVersion(
        agent(),
        agentInstance(),
        dir(),
        packageJson(),
        npmCommander(),
        npmCommanderSetup(),
      ),
    ).to.equal('3.10.1969')
  })
})
