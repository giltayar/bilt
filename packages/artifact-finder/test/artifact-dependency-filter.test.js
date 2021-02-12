import mocha from 'mocha'
const {describe, it} = mocha
import {expect} from 'chai'
import artifactsFilter from '../src/artifact-dependency-filter.js'

describe('artifactDependencyFilter', function () {
  it('should filter out dependencies that are not in list of artifacts', function () {
    expect(
      artifactsFilter([
        {name: 'foo', dependencies: ['a', 'b']},
        {name: 'bar', dependencies: ['c', 'b']},
      ]),
    ).to.have.deep.members([
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
    ).to.have.deep.members([
      {name: 'foo', dependencies: ['bar', 'zoo']},
      {name: 'zoo', dependencies: ['bar']},
      {name: 'bar', dependencies: []},
    ])
  })

  it('should keep properties that are not "dependencies"', function () {
    expect(artifactsFilter([{name: 'foo', dependencies: [], a: 1, b: 2}])).to.have.deep.members([
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
    ).to.have.deep.members([
      {name: 'foo', dependencies: ['bar', 'zoo'], a: 1},
      {name: 'zoo', dependencies: ['bar']},
      {name: 'bar', dependencies: []},
    ])
  })
})
