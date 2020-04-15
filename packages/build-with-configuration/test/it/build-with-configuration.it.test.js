'use strict'
const {describe, it, before} = require('mocha')
const {expect} = require('chai')
const {makeTemporaryDirectory, readFileAsString, writeFile} = require('@bilt/scripting-commons')

describe('build-with-configuration (it)', function () {
  /**@type {import('../../src/types').BuildConfiguration} */
  const buildConfiguration = {
    jobs: {
      build: {
        steps: {
          during: [
            {name: 'name1', run: 'touch buildname1', enableOption: ['name1opt']},
            {name: 'name15', run: 'echo built>buildname2', enableOption: ['name15opt', 'git']},
            {
              name: 'name2',
              run: 'echo ${BILT_OPTION_MESSAGE} >buildname3',
              env: {a: 'b'},
              parameterOption: ['message'],
            },
          ],
        },
      },
    },
  }

  /**@type {import('../../src/build-with-configuration')} */
  let bwc
  before(() => {
    delete require.cache[require.resolve('@bilt/scripting-commons')]
    delete require.cache[require.resolve('../../src/build-with-configuration')]
    delete require.cache[require.resolve('../../src/execute-step')]
    bwc = require('../../src/build-with-configuration')
  })

  it('should execute a job using sh', async () => {
    const cwd = await makeTemporaryDirectory()

    await writeFile('buildname2', '', {cwd})

    for await (const _ of bwc.executeJob(buildConfiguration.jobs.build, 'during', cwd, {
      message: 'yay',
      name1opt: true,
    })) {
    }

    expect(await readFileAsString('buildname1', {cwd})).to.equal('')
    expect(await readFileAsString('buildname2', {cwd})).to.equal('')
    expect(await readFileAsString('buildname3', {cwd})).to.equal('yay\n')
  })
})
