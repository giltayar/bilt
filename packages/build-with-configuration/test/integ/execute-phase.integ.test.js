import mocha from 'mocha'
const {describe, it, before} = mocha
import {expect} from 'chai'
import {
  childProcessWait,
  makeTemporaryDirectory,
  readFileAsString,
  writeFile,
} from '@bilt/scripting-commons'

describe('build-with-configuration (integ)', function () {
  /**@type {import('../../src/types').Steps} */
  const steps = [
    {name: 'name1', run: 'touch buildname1', enableOption: ['name1opt']},
    {name: 'name15', run: 'echo built>buildname2', enableOption: ['name15opt', 'git']},
    {
      name: 'name2',
      run: 'echo ${BILT_OPTION_MESSAGE} >buildname3',
      env: {a: 'b'},
      parameterOption: ['message'],
    },
  ]

  /**@type {import('../../src/build-with-configuration').getPhaseExecution} */
  let getPhaseExecution
  before(async () => {
    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    getPhaseExecution = (await import('../../src/build-with-configuration.js')).getPhaseExecution
  })

  it('should execute a job using sh', async () => {
    const cwd = await makeTemporaryDirectory()

    await writeFile('buildname2', '', {cwd})

    const stepExecutions = getPhaseExecution(
      steps,
      cwd,
      {
        message: 'yay',
        name1opt: true,
      },
      {},
    )

    for (const stepExecution of stepExecutions.filter((se) => se.isEnabled())) {
      if (await stepExecution.shouldSkip()) continue
      const childProcess = await stepExecution.executeToChildProcess()

      await childProcessWait(childProcess, stepExecution.info().command)
    }

    expect(await readFileAsString('buildname1', {cwd})).to.equal('')
    expect(await readFileAsString('buildname2', {cwd})).to.equal('')
    expect(await readFileAsString('buildname3', {cwd})).to.equal('yay\n')
  })
})
