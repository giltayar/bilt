'use strict'

const {describe, it} = require('mocha')
const {expect} = require('chai')
const jobStateFactory = require('../src/in-memory-job-state')

describe('in-memory-job-state', () => {
  it('should return undefined if no state', async () => {
    const stater = await jobStateFactory()

    expect(await stater.getState({id: 'sdfasdf'})).to.be.undefined
  })

  it('should return the state that was set', async () => {
    const stater = await jobStateFactory()

    await stater.setState({id: 'foo'}, 5)

    expect(await stater.getState({id: 'foo'})).to.equal(5)
  })

  it('should have different states for different jobs', async () => {
    const stater = await jobStateFactory()

    await stater.setState({id: 'foo'}, 4)
    await stater.setState({id: 'bar'}, 5)

    expect(await stater.getState({id: 'foo'})).to.equal(4)
    expect(await stater.getState({id: 'bar'})).to.equal(5)
  })

  it('should return the last state set', async () => {
    const stater = await jobStateFactory()

    await stater.setState({id: 'foo'}, 4)
    await stater.setState({id: 'foo'}, 5)

    expect(await stater.getState({id: 'foo'})).to.equal(5)
  })

  it('same job in different factories have different state', async () => {
    const stater1 = await jobStateFactory()
    const stater2 = await jobStateFactory()

    await stater1.setState({id: 'foo'}, 4)
    await stater2.setState({id: 'foo'}, 5)

    expect(await stater1.getState({id: 'foo'})).to.equal(4)
    expect(await stater2.getState({id: 'foo'})).to.equal(5)
  })
})
