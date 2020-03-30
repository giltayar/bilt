'use strict'

const {describe, it} = require('mocha')
const {expect} = require('chai')
const artifactsFilter = require('../src/artifact-dependency-filter')

describe('artifactDependencyFilter', function () {
  it('should filter out dependencies that are not in list of artifacts', function () {
    expect(
      artifactsFilter([
        {name: 'foo', dependencies: ['a', 'b']},
        {name: 'bar', dependencies: ['c', 'b']},
      ]),
    ).to.deep.have.members([
      {name: 'foo', dependencies: []},
      {name: 'bar', dependencies: []},
    ])
  })

  it('should not filter out dependencies that are in list of artifacts', function () {
    expect(
      artifactsFilter([
        {name: 'foo', dependencies: ['bar', 'zoo']},
        {name: 'zoo', dependencies: ['bar']},
        {name: 'bar', dependencies: []},
      ]),
    ).to.deep.have.members([
      {name: 'foo', dependencies: ['bar', 'zoo']},
      {name: 'zoo', dependencies: ['bar']},
      {name: 'bar', dependencies: []},
    ])
  })

  it('should keep properties that are not "dependencies"', function () {
    expect(artifactsFilter([{name: 'foo', dependencies: [], a: 1, b: 2}])).to.deep.have.members([
      {name: 'foo', dependencies: [], a: 1, b: 2},
    ])
  })

  it('should do the right thing in a test that includes all the above tests!', function () {
    expect(
      artifactsFilter([
        {name: 'foo', dependencies: ['bar', 'zoo', 'a'], a: 1},
        {name: 'zoo', dependencies: ['bar']},
        {name: 'bar', dependencies: ['b']},
      ]),
    ).to.deep.have.members([
      {name: 'foo', dependencies: ['bar', 'zoo'], a: 1},
      {name: 'zoo', dependencies: ['bar']},
      {name: 'bar', dependencies: []},
    ])
  })
})
