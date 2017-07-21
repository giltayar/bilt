'use strict';
//@flow
const Promise = require('bluebird');
const {describe, it} = require('mocha');
const {expect} = require('chai');
const {artifactWalker, fetchEntriesOfDir} = require('../src/artifact-walker');
const sinon = require('sinon');

describe('artifactWalker', function() {
  const id = x => x;

  it('should work with just one dir', Promise.coroutine(function*() {
    const dir = 'foo';
    const fetchEntriesOfDir = sinon.stub().withArgs(dir).returns(Promise.resolve([
      {name: 'zoo.json', type: 'file'},
      {name: 'package.json', type: 'file'}
    ]));
    const extractArtifacts = sinon.stub();
    extractArtifacts.withArgs('foo/package.json').returns(Promise.resolve('food'));
    extractArtifacts.withArgs('foo/zoo.json').returns(Promise.resolve(undefined));

    const deps = yield artifactWalker(fetchEntriesOfDir, dir, extractArtifacts, id);

    expect(deps).to.deep.equal(['food']);
  }));

  it('should work with two subdirs', Promise.coroutine(function*() {
    const dir = 'foo';
    const fetchEntriesOfDir = sinon.stub();
    fetchEntriesOfDir.withArgs(dir).returns(Promise.resolve([
      {name: 'a', type: 'dir'},
      {name: 'b', type: 'dir'}
    ]));
    fetchEntriesOfDir.withArgs(dir + '/a').returns(Promise.resolve([
      {name: 'package.json', type: 'file'},
      {name: 'a.json', type: 'file'}
    ]));
    fetchEntriesOfDir.withArgs(dir + '/b').returns(Promise.resolve([
      {name: 'package.json', type: 'file'},
      {name: 'b.json', type: 'file'}
    ]));
    const extractArtifacts = sinon.stub();
    extractArtifacts.withArgs('foo/a/package.json').returns(Promise.resolve('a'));
    extractArtifacts.withArgs('foo/a/a.json').returns(Promise.resolve(undefined));
    extractArtifacts.withArgs('foo/b/package.json').returns(Promise.resolve(['b']));
    extractArtifacts.withArgs('foo/b/b.json').returns(Promise.resolve(undefined));

    const deps = yield artifactWalker(fetchEntriesOfDir, dir, extractArtifacts, id);

    expect(deps).to.deep.equal(['a', 'b']);    
  }));

  it('should work with subdir inside another', Promise.coroutine(function*() {
    const dir = 'foo';
    const fetchEntriesOfDir = sinon.stub();
    fetchEntriesOfDir.withArgs(dir).returns(Promise.resolve([
      {name: 'a', type: 'dir'}
    ]));
    fetchEntriesOfDir.withArgs(dir + '/a').returns(Promise.resolve([
      {name: 'a.json', type: 'file'},
      {name: 'b', type: 'dir'}
    ]));
    fetchEntriesOfDir.withArgs(dir + '/a/b').returns(Promise.resolve([
      {name: 'package.json', type: 'file'}
    ]));
    const extractArtifacts = sinon.stub();
    extractArtifacts.returns(Promise.resolve(undefined));
    extractArtifacts.withArgs('foo/a/a.json').returns(Promise.resolve(undefined));
    extractArtifacts.withArgs('foo/a/b/package.json').returns(Promise.resolve('b'));

    const deps = yield artifactWalker(fetchEntriesOfDir, dir, extractArtifacts, id);

    expect(deps).to.deep.equal(['b']);    
  }));

  it('should ignore subdirs of a leaf', Promise.coroutine(function*() {
    const dir = 'foo';
    const fetchEntriesOfDir = sinon.stub();
    fetchEntriesOfDir.withArgs(dir).returns(Promise.resolve([
      {name: 'a', type: 'dir'}
    ]));
    fetchEntriesOfDir.withArgs(dir + '/a').returns(Promise.resolve([
      {name: 'package.json', type: 'file'},
      {name: 'a.json', type: 'file'},
      {name: 'b', type: 'dir'}
    ]));
    fetchEntriesOfDir.withArgs(dir + '/a/b').returns(Promise.resolve([
      {name: 'package.json', type: 'file'}
    ]));
    const extractArtifacts = sinon.stub();
    extractArtifacts.returns(Promise.resolve(undefined));
    extractArtifacts.withArgs('foo/a/package.json').returns(Promise.resolve('a'));
    extractArtifacts.withArgs('foo/a/a.json').returns(Promise.resolve(undefined));
    extractArtifacts.withArgs('foo/a/b/package.json').returns(Promise.resolve('b'));

    const deps = yield artifactWalker(fetchEntriesOfDir, dir, extractArtifacts, id);

    expect(deps).to.deep.equal(['a']);    
  }));

  it('should support two artifacts in a dir and combine them with extractorMerger', Promise.coroutine(function*() {
    const dir = 'foo';
    const fetchEntriesOfDir = sinon.stub();
    fetchEntriesOfDir.withArgs(dir).returns(Promise.resolve([
      {name: 'a', type: 'dir'}
    ]));
    fetchEntriesOfDir.withArgs(dir + '/a').returns(Promise.resolve([
      {name: 'package.json', type: 'file'},
      {name: 'a.json', type: 'file'}
    ]));
    const extractArtifacts = sinon.stub();
    extractArtifacts.returns(Promise.resolve(undefined));
    extractArtifacts.withArgs('foo/a/package.json').returns(Promise.resolve('a1'));
    extractArtifacts.withArgs('foo/a/a.json').returns(Promise.resolve('a2'));

    const deps = yield artifactWalker(fetchEntriesOfDir, dir, extractArtifacts, artifacts => {
      expect(artifacts).to.have.members(['a1', 'a2']);

      return ['b1', 'b2']
    });

    expect(deps).to.deep.equal(['b1', 'b2']);    
  }));
});

describe('fetchEntriesOfDir', function() {
  it('should work with a folder with files and folders', Promise.coroutine(function*() {
    const entries = yield fetchEntriesOfDir(__dirname + '/fetch-entries-test-dir');

    const entriesWithoutSystemFiles = entries.filter(e => !e.name.startsWith('.'));
    expect(entriesWithoutSystemFiles).to.deep.have.members([
      {name: 'a.txt', type: 'file'},
      {name: 'b.txt', type: 'file'},
      {name: 'fold', type: 'dir'}
    ]);
  }));
});