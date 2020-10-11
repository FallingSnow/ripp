import React, { useState } from 'react';
import { Switch, Route } from 'react-router-dom';
import { Card, Elevation, H5, H2, FormGroup, Tag, InputGroup, Button, Tree } from "@blueprintjs/core";
import { Query } from '@apollo/react-components';
import { useQuery, useLazyQuery } from '@apollo/react-hooks';
import { gql } from 'apollo-boost';

class DirectoryView extends React.Component {
  state = {
    nodes: null
  };
  componentDidMount = this.componentDidUpdate;
  async componentDidUpdate(prevProps = {}, prevState) {
    const {path} = this.props;
    let nodes = null, error;
    if (prevProps.path !== path)
      try {
        console.debug('Getting readdir for', path);
        const results = await this.loadDirectory(path);
        nodes = DirectoryView.directoriesToNodes(results.data.directories);
      } catch (err) {
        error = err;
        console.error(error);
      } finally {
        this.setState({nodes, error});
      }
  }
  static directoriesToNodes(directories) {
    return directories.map( ({path, relativePath}) => ({id: path, hasCaret: true, icon: 'folder-close', label: relativePath}));
  }
  async loadDirectory(path, nodeData) {
    return await window.apollo.query({query: gql`{ directories(at: "${path}") { path, relativePath } }`, variables: {path}});
  }
  async openNode(nodeData) {
    console.debug('opening node', nodeData.id)
    nodeData.icon = "folder-open";
    nodeData.isExpanded = true;
    if (!nodeData.childNodes) {
      nodeData.childNodes = [{id: false, label: 'Loading...'}];
      this.setState(this.state);
      try {
        const results = await this.loadDirectory(nodeData.id, nodeData);
        let childNodes = DirectoryView.directoriesToNodes(results.data.directories);
        if (childNodes.length === 0) {
          childNodes = [{id: false, label: 'Empty'}];
        }
        nodeData.childNodes = childNodes;
      } catch (error) {
        nodeData.childNodes = [{id: false, label: error.toString()}];
      }
    }
    this.setState(this.state);
  }
  closeNode(nodeData) {
    nodeData.icon = "folder-close";
    nodeData.isExpanded = false;
    this.setState(this.state);
  }
  selectNode(nodeData) {
    if (nodeData.id === false)
      return;
    const previouslySelected = nodeData.isSelected;
    DirectoryView.forEachNode(this.state.nodes, n => n.isSelected = false)
    nodeData.isSelected = !previouslySelected;
    this.props.onSelect(nodeData);
    this.setState(this.state);
  }
  static forEachNode(nodes, cb) {
    for (const node of nodes) {
      cb(node);
      DirectoryView.forEachNode(node.childNodes || [], cb);
    }
  }
  render() {

    const {path, ...props} = this.props;

    if (!this.state.nodes)
        return <H5>Loading...</H5>;
    if (this.state.error)
      return <H5>{this.state.error.toString()}</H5>;

    return (
      <Tree {...props} onNodeExpand={this.openNode.bind(this)} onNodeClick={this.selectNode.bind(this)} onNodeCollapse={this.closeNode.bind(this)} contents={this.state.nodes}/>
    );
  }
}

function DirectoryList({path = "/", onSelect, ...props}) {
  return (
    <div {...props}>
      <DirectoryView onSelect={onSelect} path={path} />
    </div>
  );
}

function calculateNewPath(currentPath, target) {
  if (target === '..') {
    return currentPath.substr(0, currentPath.indexOf('/') + 1);
  }
  return `${currentPath === '/' ? '' : currentPath}/${target}`;
}

export default class Create extends React.Component {
  state = {
    path: ''
  };
  async submit(e) {
    e.preventDefault();
  }
  render() {
    const {history: {push}} = this.props;
    return (<div css={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column'
        }}>
        <H2 css={{textAlign: 'center'}}>Add a Library</H2>
          <form onSubmit={this.submit}>
              <FormGroup
                  label="Name"
                  labelFor="name"
                  labelInfo="*"
              >
                <InputGroup id="name" name="name" />
              </FormGroup>
              <FormGroup
                  label="Folder Location"
                  labelFor="library-path"
                  labelInfo="*"
              >
                <InputGroup readOnly={true} id="library-path" name="library-path" value={this.state.path} />
                <DirectoryList css={{border: '1px solid lightgrey', width: '50em'}} onSelect={nodeData => this.setState({path: nodeData.id})} />
              </FormGroup>
              <FormGroup css={{textAlign: 'right'}}>
                <Button type="submit" intent="primary" rightIcon="plus">
                  Create Library
                </Button>
              </FormGroup>
          </form>
    </div>);
  }
}
