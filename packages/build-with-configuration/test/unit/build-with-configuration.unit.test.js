'use strict'
const {describe, it, before, beforeEach, afterEach} = require('mocha')
const {expect, use} = require('chai')
const td = require('testdouble')
use(require('chai-subset'))

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
    let sh
    /**@type {import('../../src/build-with-configuration')} */
    let bwc
    beforeEach(() => {
      ;({sh} = td.replace(require.resolve('@bilt/scripting-commons')))

      bwc = require('../../src/build-with-configuration')
    })
    afterEach(() => td.reset())

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
          })
        } else {
          expect(stepInfo).to.eql({name: 'name2', enableOptions: [], parameterOptions: ['message']})
        }
      }

      expect(i).to.equal(2)

      td.verify(
        sh('run1', {
          cwd: 'dir1',
          env: {...process.env, BILT_OPTION_NAME1OPT: 'true', BILT_OPTION_MESSAGE: 'message1'},
        }),
        {times: 1},
      )
      td.verify(sh('run2', {cwd: 'dir1', env: td.matchers.contains({a: 'b', c: 'foobar found'})}), {
        times: 1,
      })
    })

    it('should not fail when executing empty phase', async () => {
      let i = 0
      for await (const _ of bwc.executeJob(
        buildConfiguration.jobs.build,
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
    before(() => {
      bwc = require('../../src/build-with-configuration')
    })

    it('jobInfo should work', () => {
      const jobInfo = bwc.jobInfo(buildConfiguration, 'build')
      expect(jobInfo).to.containSubset({
        enableOptions: ['name1opt', 'git'],
        parameterOptions: ['message'],
      })
      expect(jobInfo.dependentEnableOptions.get('name1opt')).to.eql('git')
      expect(jobInfo.dependentEnableOptions.get('name15opt')).to.eql('git')
      expect(jobInfo.dependentEnableOptions.size).to.eql(2)
    })
  })
})
