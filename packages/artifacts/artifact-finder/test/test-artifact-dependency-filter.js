'use strict'
//@flow

const {describe, it} = require('mocha');
const {expect} = require('chai');
const artifactsFilter = require('../src/artifact-dependency-filter');

describe('artifactDependencyFilter', function() {
  it('should filter out dependencies that are not in list of artifacts', function() {
    expect(artifactsFilter(
      [
        {artifact: 'foo', dependencies: ['a', 'b']},
        {artifact: 'bar', dependencies: ['c', 'b']},
      ]
    )).to.deep.have.members(
      [
        {artifact: 'foo', dependencies: []},
        {artifact: 'bar', dependencies: []},
      ]
    );
  });
  
  it('should not filter out dependencies that are in list of artifacts', function() {
    expect(artifactsFilter(
      [
        {artifact: 'foo', dependencies: ['bar', 'zoo']},
        {artifact: 'zoo', dependencies: ['bar']},
        {artifact: 'bar', dependencies: []},
      ]
    )).to.deep.have.members(
      [
        {artifact: 'foo', dependencies: ['bar', 'zoo']},
        {artifact: 'zoo', dependencies: ['bar']},
        {artifact: 'bar', dependencies: []},
      ]
    );
  });
  
  it('should keep properties that are not "dependencies"', function() {
    expect(artifactsFilter(
      [
        {artifact: 'foo', dependencies: [], a: 1, b: 2}
      ]
    )).to.deep.have.members(
      [
        {artifact: 'foo', dependencies: [], a: 1, b: 2}
      ]
    );
  });

  it('should do the right thing in a test that includes all the above tests!', function() {
    expect(artifactsFilter(
      [
        {artifact: 'foo', dependencies: ['bar', 'zoo', 'a'], a: 1},
        {artifact: 'zoo', dependencies: ['bar']},
        {artifact: 'bar', dependencies: ['b']},
      ]
    )).to.deep.have.members(
      [
        {artifact: 'foo', dependencies: ['bar', 'zoo'], a: 1},
        {artifact: 'zoo', dependencies: ['bar']},
        {artifact: 'bar', dependencies: []},
      ]
    );
  });
});
