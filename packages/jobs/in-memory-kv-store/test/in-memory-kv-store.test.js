'use strict'

const {describe, it} = require('mocha')
const {expect} = require('chai')
const kvStoreFactory = require('../src/in-memory-kv-store')

describe('in-memory-kv-store', () => {
  it('should return undefined if no key', async () => {
    const store = await kvStoreFactory()

    expect(await store.get('sdfasdf')).to.be.undefined
  })

  it('should return the value that was set', async () => {
    const store = await kvStoreFactory()

    await store.set('foo', 5)

    expect(await store.get('foo')).to.equal(5)
  })

  it('should have different value for different keys', async () => {
    const store = await kvStoreFactory()

    await store.set('foo', 4)
    await store.set('bar', 5)

    expect(await store.get('foo')).to.equal(4)
    expect(await store.get('bar')).to.equal(5)
  })

  it('should return the last value set', async () => {
    const store = await kvStoreFactory()

    await store.set('foo', 4)
    await store.set('foo', 5)

    expect(await store.get('foo')).to.equal(5)
  })

  it('same key in different stores have different values', async () => {
    const store1 = await kvStoreFactory()
    const store2 = await kvStoreFactory()

    await store1.set('foo', 4)
    await store2.set('foo', 5)

    expect(await store1.get('foo')).to.equal(4)
    expect(await store2.get('foo')).to.equal(5)
  })
})
