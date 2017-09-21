'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')

const pluginImport = require('../..')

describe('plugin-import', function() {
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
      {appConfigsList: [{a: {b: 1}, c: 'c'}, {a: {b: 'b'}}], baseDirectory: __dirname},
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

  it('should pass the correct information when loading the plugin')
  it('should load plugins from the baseDirectory')
  it('should load plugins from the npm system')
  it('should load inline plugins')
  it('should load same instance for same config')
  it('should load different instances for different')
})
