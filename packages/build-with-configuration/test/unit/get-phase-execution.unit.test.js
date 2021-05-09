import mocha from 'mocha'
const {describe, it, beforeEach, afterEach} = mocha
import {expect, use} from 'chai'
import chaiSubset from 'chai-subset'
import {replaceEsm, reset, verify, matchers} from 'testdouble'
use(chaiSubset)

describe('get-phase-execution (unit)', function () {
  /**@type {import('../../src/types').Steps} */
  const steps = [
    {name: 'name1', run: 'run1', enableOption: ['name1opt', 'git']},
    {name: 'name15', run: 'run', enableOption: ['name15opt', 'git']},
    {
      name: 'name2',
      run: 'run2',
      env: {a: 'b', c: {function: 'async ({foo}) => (require("util"),foo + " found")'}},
      parameterOption: ['message'],
    },
    {
      name: 'name3',
      run: 'never-executed',
      condition: false,
      env: {},
    },
  ]

  /** @type {import('@bilt/scripting-commons').sh} */
  let sh
  /**@type {import('../../src/build-with-configuration')} */
  let bwc
  beforeEach(async () => {
    ;({sh} = await replaceEsm('@bilt/scripting-commons'))

    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    bwc = await import('../../src/build-with-configuration.js')
  })
  afterEach(() => reset())

  it('should "execute" a job', async () => {
    const phaseExecution = bwc
      .getPhaseExecution(
        steps,
        'dir1',
        {
          name1opt: true,
          name15opt: false,
          message: 'message1',
        },
        {foo: 'foobar'},
      )
      .filter((pe) => pe.isEnabled())

    expect(phaseExecution.map((pe) => pe.info())).to.eql([
      {
        name: 'name1',
        command: 'run1',
        enableOptions: ['name1opt', 'git'],
        parameterOptions: [],
      },
      {name: 'name2', enableOptions: [], command: 'run2', parameterOptions: ['message']},
      {name: 'name3', enableOptions: [], command: 'never-executed', parameterOptions: []},
    ])
    expect(await phaseExecution[0].shouldSkip()).to.equal(false)
    expect(await phaseExecution[1].shouldSkip()).to.equal(false)
    expect(await phaseExecution[2].shouldSkip()).to.equal(true)

    await phaseExecution[0].execute()
    await phaseExecution[1].execute()

    verify(
      sh('run1', {
        cwd: 'dir1',
        env: {...process.env, BILT_OPTION_NAME1OPT: 'true', BILT_OPTION_MESSAGE: 'message1'},
      }),
      {times: 1},
    )
    verify(sh('run2', {cwd: 'dir1', env: matchers.contains({a: 'b', c: 'foobar found'})}), {
      times: 1,
    })
  })

  it('should return empty array on undefined and empty array', async () => {
    expect(bwc.getPhaseExecution(undefined, 'dir1', {}, {})).to.eql([])
    expect(bwc.getPhaseExecution([], 'dir1', {}, {})).to.eql([])
  })
})
