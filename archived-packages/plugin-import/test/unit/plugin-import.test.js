'use strict'
const path = require('path')
const fs = require('fs')
const {promisify: p} = require('util')
const {describe, it} = require('mocha')
const {expect} = require('chai')

const pluginImport = require('../..')

describe('plugin-import', function() {
  it('should load plugins from the baseDirectory', async () => {
    const pimport = pluginImport([{foo: {package: './my-init-args-returner', a: 2}}], {
      baseDirectory: path.join(__dirname, 'more'),
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
  it('should load inline plugin without a name', async () => {
    const pimport = pluginImport([
      {
        foo:
          (0,
          () => {
            return 2
          }),
      },
    ])
    const plugin = await pimport('foo')

    expect(plugin).to.equal(2)
  })
  it('should load same instance for same config', async () => {
    const aConfig = {a: 42}
    const pimport = pluginImport(
      [
        {
          foo: {package: './my-config-returner', ...aConfig},
          bar: {package: './my-config-returner', ...aConfig},
        },
      ],
      {baseDirectory: __dirname},
    )

    const foo = await pimport('foo')
    const bar = await pimport('bar')

    expect(foo).to.equal(bar)
    expect(foo.returnConfig()).to.equal(bar.returnConfig())
    expect(foo.returnConfig()).to.eql({a: 42})
    expect(foo.returnKind()).to.equal('foo')
    expect(bar.returnKind()).to.equal('foo')
  })

  it('should load different instances for different configs', async () => {
    const pimport = pluginImport(
      [
        {
          foo: {package: './my-config-returner', a: 42},
          bar: {package: './my-config-returner', a: 43},
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

  it('should merge normalized plugin list', async () => {
    const pimport = pluginImport(
      [
        {
          bar: {
            package: './my-config-returner',
            aConfig: 'a',
            bConfig: 'b',
          },
        },
        {
          bar: './my-config-returner',
        },
        {
          bar: {
            cConfig: 'c',
          },
        },
      ],
      {baseDirectory: __dirname},
    )
    expect((await pimport('bar')).returnConfig()).to.eql({
      aConfig: 'a',
      bConfig: 'b',
      cConfig: 'c',
    })
  })
  it('should merge the plugin lists correctly', async () => {
    const pimport = pluginImport(
      [
        {
          bar: {
            package: './my-config-returner',
            aConfig: 1,
            cConfig: 'c',
          },
        },
        {
          bar: {
            package: './my-config-returner',
            aConfig: 'a',
            bConfig: 'b',
          },
          foo: async ({pimport}) => ({
            returnPimport() {
              return pimport
            },
          }),
        },
      ],
      {baseDirectory: __dirname},
    )
    expect((await pimport('foo')).returnPimport()).to.equal(pimport)
    expect((await pimport('bar')).returnConfig()).to.eql({
      aConfig: 'a',
      bConfig: 'b',
      cConfig: 'c',
    })
  })

  it('should support undefined pluginLists', async () => {
    const pimport = pluginImport([
      {
        foo: () => {
          return 1
        },
      },
      undefined,
    ])
    const plugin = await pimport('foo')

    expect(plugin).to.equal(1)
  })

  it('should pass the correct information when loading the plugin', async () => {
    const pimport = pluginImport([{foo: {package: './more/my-init-args-returner', a: 2}}], {
      baseDirectory: __dirname,
    })

    const initArgs = (await pimport('foo')).returnInitArgs()

    expect(Object.keys(initArgs)).to.have.members([
      'directory',
      'config',
      'pimport',
      'kind',
      'plugins',
    ])
    expect(initArgs).to.have.property('pimport', pimport)
    expect(initArgs).to.have.property('directory', __dirname)
    expect(initArgs).to.have.deep.property('config', {a: 2})
    expect(initArgs).to.have.deep.property('kind', 'foo')
  })

  it('should autoload other services when the factory has a `services` property', async () => {
    const service = ({plugins: [a, b]}) => {
      return {
        a() {
          return a
        },
        b() {
          return b
        },
      }
    }
    service.plugins = ['aService', 'bService']

    const aService = () => 4
    const bService = () => 5
    const pimport = pluginImport([{foo: service, aService, bService}])

    const foo = await pimport('foo')

    expect(foo.a()).to.equal(4)
    expect(foo.b()).to.equal(5)
  })
})
