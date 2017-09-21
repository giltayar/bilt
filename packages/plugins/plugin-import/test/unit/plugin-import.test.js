'use strict'
const path = require('path')
const fs = require('fs')
const {promisify: p} = require('util')
const {describe, it} = require('mocha')
const {expect} = require('chai')

const pluginImport = require('../..')

describe('plugin-import', function() {
  it('should load plugins from the baseDirectory', async () => {
    const pimport = pluginImport([{foo: {'./my-init-args-returner': {a: 2}}}], {
      baseDirectory: path.join(__dirname, 'more'),
      appConfigs: [{app: 1}],
    })

    const initArgs = (await pimport('foo')).returnInitArgs()

    expect(initArgs.config.a).to.equal(2)
  })

  it('should load plugins from the npm system', async () => {
    const newNodeModule = path.resolve(__dirname, '../../node_modules/__test-plugin.js')
    try {
      await p(fs.writeFile)(newNodeModule, ` module.exports = () => {return 1} `)
      const pimport = pluginImport([{foo: '__test-plugin'}])

      const plugin = await pimport('foo')

      expect(plugin).to.equal(1)
    } finally {
      await p(fs.unlink)(newNodeModule)
    }
  })
  it('should load inline plugins', async () => {
    const pimport = pluginImport([
      {
        foo: () => {
          return 1
        },
      },
    ])
    const plugin = await pimport('foo')

    expect(plugin).to.equal(1)
  })
  it('should load same instance for same config', async () => {
    const aConfig = {a: 42}
    const pimport = pluginImport(
      [
        {
          foo: {'./my-config-returner': {...aConfig}},
          bar: {'./my-config-returner': {...aConfig}},
        },
      ],
      {baseDirectory: __dirname},
    )

    const foo = await pimport('foo')
    const bar = await pimport('bar')

    expect(foo).to.equal(bar)
    expect(foo.returnConfig()).to.equal(bar.returnConfig())
    expect(foo.returnConfig()).to.eql({a: 42})
  })

  it('should load different instances for different configs', async () => {
    const pimport = pluginImport(
      [
        {
          foo: {'./my-config-returner': {a: 42}},
          bar: {'./my-config-returner': {a: 43}},
        },
      ],
      {baseDirectory: __dirname},
    )

    const foo = await pimport('foo')
    const bar = await pimport('bar')

    expect(foo).to.not.equal(bar)
    expect(foo.returnConfig()).to.not.equal(bar.returnConfig())
    expect(foo.returnConfig()).to.eql({a: 42})
    expect(bar.returnConfig()).to.eql({a: 43})
  })

  it('should merge the plugin lists correctly', async () => {
    const pimport = pluginImport(
      [
        {
          foo: async ({appConfig}) => ({
            returnAppConfig1() {
              return appConfig
            },
          }),
        },
        {
          bar: {
            './my-config-returner': {
              aConfig: 1,
              cConfig: 'c',
            },
          },
        },
        {
          bar: {
            './my-config-returner': {
              aConfig: 'a',
              bConfig: 'b',
            },
          },
          foo: async ({appConfig, pimport}) => ({
            returnAppConfig2() {
              return appConfig
            },
            returnPimport() {
              return pimport
            },
          }),
        },
      ],
      {appConfigs: [{a: {b: 1}, c: 'c'}, {a: {b: 'b'}}], baseDirectory: __dirname},
    )
    expect((await pimport('foo')).returnAppConfig1).to.be.undefined
    expect((await pimport('foo')).returnAppConfig2()).to.eql({a: {b: 'b'}, c: 'c'})
    expect((await pimport('foo')).returnPimport()).to.equal(pimport)
    expect((await pimport('bar')).returnConfig()).to.eql({
      aConfig: 'a',
      bConfig: 'b',
      cConfig: 'c',
    })
  })

  it('should pass the correct information when loading the plugin', async () => {
    const pimport = pluginImport([{foo: {'./more/my-init-args-returner': {a: 2}}}], {
      baseDirectory: __dirname,
      appConfigs: [{app: 1}],
    })

    const initArgs = (await pimport('foo')).returnInitArgs()

    expect(Object.keys(initArgs)).to.have.members(['appConfig', 'directory', 'config', 'pimport'])
    expect(initArgs).to.have.property('pimport', pimport)
    expect(initArgs).to.have.property('directory', __dirname)
    expect(initArgs).to.have.deep.property('appConfig', {app: 1})
    expect(initArgs).to.have.deep.property('config', {a: 2})
  })
})
