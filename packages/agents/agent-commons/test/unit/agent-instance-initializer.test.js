'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')

const {initializer} = require('../..')

describe('agent-instance-intitializer', function() {
  it('should initialize same agent instance once', async () => {
    let initialized = undefined
    const module = async (ensureInitialized, c, d) => {
      return {
        async foo({agent, agentInstance}, a, b) {
          return await ensureInitialized({agent, agentInstance}, a, b)
        },
        async [initializer.initializationFunction]({agent, agentInstance}, a, b) {
          expect(initialized).to.be.undefined

          initialized = {agent, agentInstance, a, b, c, d}

          return a + b + c + d
        },
      }
    }

    const initializedModule = initializer(module)

    const plugin = await initializedModule(1, 2)

    const ret = await plugin.foo({agent: 1, agentInstance: {id: 4}}, 3, 4)

    expect(ret).to.equal(1 + 2 + 3 + 4)
    expect(initialized).to.eql({agent: 1, agentInstance: {id: 4}, a: 3, b: 4, c: 1, d: 2})

    const ret2 = await plugin.foo({agent: 1, agentInstance: {id: 4}}, 3, 4)

    expect(ret2).to.be.undefined
    expect(initialized).to.eql({agent: 1, agentInstance: {id: 4}, a: 3, b: 4, c: 1, d: 2})
  })

  it('should initialize different agent instance twice', async () => {
    let initialized = undefined
    const module = async (ensureInitialized, c, d) => {
      return {
        async foo({agent, agentInstance}, a, b) {
          return await ensureInitialized({agent, agentInstance}, a, b)
        },
        async [initializer.initializationFunction]({agent, agentInstance}, a, b) {
          if (agentInstance.id === 4) {
            expect(initialized).to.be.undefined
          } else {
            expect(initialized).to.eql({agent: 1, agentInstance: {id: 4}, a: 3, b: 4, c: 1, d: 2})
          }

          initialized = {agent, agentInstance, a, b, c, d}

          return a + b + c + d
        },
      }
    }

    const initializedModule = initializer(module)

    const plugin = await initializedModule(1, 2)

    const ret = await plugin.foo({agent: 1, agentInstance: {id: 4}}, 3, 4)

    expect(ret).to.equal(1 + 2 + 3 + 4)
    expect(initialized).to.eql({agent: 1, agentInstance: {id: 4}, a: 3, b: 4, c: 1, d: 2})

    const ret2 = await plugin.foo({agent: 1, agentInstance: {id: 5}}, 5, 6)

    expect(ret2).to.equal(1 + 2 + 5 + 6)
    expect(initialized).to.eql({agent: 1, agentInstance: {id: 5}, a: 5, b: 6, c: 1, d: 2})
  })
})
