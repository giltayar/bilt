'use strict'
const {describe, it, before, beforeEach, afterEach} = require('mocha')
const {expect} = require('chai')
const td = require('testdouble')

describe('execute-step (unit)', function () {
  describe('executeStep', () => {
    let sh
    /**@type {import('../../src/execute-step')} */
    let es
    beforeEach(() => {
      ;({sh} = td.replace(require.resolve('@bilt/scripting-commons')))
      es = require('../../src/execute-step')
    })
    afterEach(() => td.reset())

    it('should execute a simple step', async () => {
      /**@type {import('../../src/types').Step} */
      const step = {name: 'step1', run: 'run1'}

      es.validateStep(step)
      await es.executeStep(step, 'currdir1', {}, {})

      td.verify(sh('run1', {cwd: 'currdir1', env: {...process.env}}), {times: 1})
    })

    it('should execute a simple step only if condition passes', async () => {
      /**@type {import('../../src/types').Step} */
      const step = {
        name: 'step1',
        run: 'run1',
        condition: {function: 'async ({directory}) => directory === "lalala"'},
      }

      es.validateStep(step)
      await es.executeStep(step, 'currdir1', {}, {directory: 'lalala'})
      td.verify(sh('run1', {cwd: 'currdir1', env: {...process.env}}), {times: 1})
    })

    it('should not execute a simple step only if condition passes', async () => {
      /**@type {import('../../src/types').Step} */
      const step = {
        name: 'step1',
        run: 'run1',
        condition: {function: 'async ({directory}) => directory === "wrong-dir!"'},
      }

      es.validateStep(step)
      await es.executeStep(step, 'currdir2', {}, {directory: 'lalala'})
      td.verify(sh(), {times: 0, ignoreExtraArgs: true})
    })

    it('should execute a step with the appropriate env vars', async () => {
      const env = {
        'an-env-var': '123',
        anotherOne: {function: 'function({directory}) {return directory()}'},
      }
      /**@type {import('../../src/types').Step} */
      const step = {
        name: 'step1',
        run: 'run1',
        env,
      }

      es.validateStep(step)
      await es.executeStep(step, 'currdir1', {}, {directory: () => 'yes!'})

      td.verify(
        sh('run1', {
          cwd: 'currdir1',
          env: {...process.env, 'an-env-var': '123', anotherOne: 'yes!'},
        }),
        {times: 1},
      )
    })

    it('should execute a step with the appropriate build options', async () => {
      const env = {anEnvVar: '456'}
      const buildOptions = {
        'a-build-option': '123',
        pull: true,
        push: false,
      }
      /**@type {import('../../src/types').Step} */
      const step = {
        name: 'step1',
        run: 'run1',
        env,
      }

      es.validateStep(step)
      await es.executeStep(step, 'currdir1', buildOptions, {})

      td.verify(
        sh('run1', {
          cwd: 'currdir1',
          env: {
            ...process.env,
            anEnvVar: '456',
            BILT_OPTION_A_BUILD_OPTION: '123',
            BILT_OPTION_PULL: 'true',
          },
        }),
        {times: 1},
      )
    })
  })

  describe('stepInfo', () => {
    /**@type {import('../../src/execute-step')} */
    let es
    before(() => {
      es = require('../../src/execute-step')
    })

    it('should return stepInfo for a simple step', () => {
      const step = {name: 'hi', run: 'run1'}

      es.validateStep(step)
      expect(es.stepInfo(step)).to.eql({name: 'hi', enableOptions: [], parameterOptions: []})
    })

    it('should return stepInfo for a step with simple enable and parameter', () => {
      const step = {name: 'hi', run: 'run1', enableOption: 'foo', parameterOption: 'bar'}

      es.validateStep(step)
      expect(es.stepInfo(step)).to.eql({
        name: 'hi',
        enableOptions: ['foo'],
        parameterOptions: ['bar'],
      })
    })

    it('should return stepInfo for a step with array enable and parameter', () => {
      const step = {
        name: 'hi',
        run: 'run1',
        enableOption: ['foo', 'foo2'],
        parameterOption: ['bar', 'bar2'],
      }

      es.validateStep(step)
      expect(es.stepInfo(step)).to.eql({
        name: 'hi',
        enableOptions: ['foo', 'foo2'],
        parameterOptions: ['bar', 'bar2'],
      })
    })
  })
})
