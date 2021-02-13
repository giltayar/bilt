import mocha from 'mocha'
const {describe, it, before} = mocha
import {expect} from 'chai'
import {makeTemporaryDirectory, readFileAsString, writeFile} from '@bilt/scripting-commons'

describe('build-with-configuration (integ)', function () {
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

  /**@type {import('../../src/build-with-configuration').executeJob} */
  let executeJob
  before(async () => {
    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    executeJob = (await import('../../src/build-with-configuration.js')).executeJob
  })

  it('should execute a job using sh', async () => {
    const cwd = await makeTemporaryDirectory()

    await writeFile('buildname2', '', {cwd})

    for await (const _ of executeJob(
      buildConfiguration.jobs.build,
      'during',
      cwd,
      {
        message: 'yay',
        name1opt: true,
      },
      {},
    )) {
    }

    expect(await readFileAsString('buildname1', {cwd})).to.equal('')
    expect(await readFileAsString('buildname2', {cwd})).to.equal('')
    expect(await readFileAsString('buildname3', {cwd})).to.equal('yay\n')
  })
})
