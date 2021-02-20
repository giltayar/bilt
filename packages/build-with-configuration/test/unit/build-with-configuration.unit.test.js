import mocha from 'mocha'
const {describe, it, before, beforeEach, afterEach} = mocha
import {expect, use} from 'chai'
import chaiSubset from 'chai-subset'
import {replaceEsm, reset, verify, matchers} from 'testdouble'
use(chaiSubset)

describe('build-with-configuration (unit)', function () {
  /**@type {import('../../src/types').BuildConfiguration} */
  const buildConfiguration = {
    jobs: {
      build: {
        steps: {
          during: [
            {name: 'name1', run: 'run1', enableOption: ['name1opt', 'git']},
            {name: 'name15', run: 'run', enableOption: ['name15opt', 'git']},
            {
              name: 'name2',
              run: 'run2',
              env: {a: 'b', c: {function: '({foo}) => (require("util"),foo + " found")'}},
              parameterOption: ['message'],
            },
          ],
        },
      },
    },
  }

  describe('executeJob', () => {
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

    it('should execute a job', async () => {
      bwc.validateBuildConfiguration(buildConfiguration, '/')

      let i = 0
      for await (const stepInfo of bwc.executeJob(
        buildConfiguration.jobs.build,
        'during',
        'dir1',
        {
          name1opt: true,
          name15opt: false,
          message: 'message1',
        },
        {foo: 'foobar'},
      )) {
        if (i++ === 0) {
          expect(stepInfo).to.eql({
            name: 'name1',
            enableOptions: ['name1opt', 'git'],
            parameterOptions: [],
            command: 'run1',
          })
        } else {
          expect(stepInfo).to.eql({
            name: 'name2',
            command: 'run2',
            enableOptions: [],
            parameterOptions: ['message'],
          })
        }
      }

      expect(i).to.equal(2)

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

    it('should not fail when executing empty phase', async () => {
      let i = 0
      for await (const _ of bwc.executeJob(
        buildConfiguration.jobs.build,
        //@ts-ignore
        'phase-does-not-exist',
        'dir1',
        {
          name1opt: true,
          name15opt: false,
          message: 'message1',
        },
        {foo: 'foobar'},
      )) {
        ++i
      }

      expect(i).to.eql(0)
    })
  })

  describe('jobInfo', () => {
    /**@type {import('../../src/build-with-configuration')} */
    let bwc
    before(async () => {
      // eslint-disable-next-line node/no-unsupported-features/es-syntax
      bwc = await import('../../src/build-with-configuration.js')
    })

    it('jobInfo should work', () => {
      const jobInfo = bwc.jobInfo(buildConfiguration, 'build')
      expect(jobInfo).to.containSubset({
        enableOptions: ['name1opt', 'git'],
        parameterOptions: ['message'],
      })
      expect(jobInfo.inAggregateOptions.get('name1opt')).to.eql('git')
      expect(jobInfo.inAggregateOptions.get('name15opt')).to.eql('git')
      expect(jobInfo.inAggregateOptions.size).to.eql(2)
      expect(jobInfo.aggregateOptions.get('git')).to.have.deep.members(['name1opt', 'name15opt'])
    })
  })
})
