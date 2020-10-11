import React from 'react';
import { Card, Elevation, H5, Text } from "@blueprintjs/core";
import { useQuery } from '@apollo/react-hooks';
import { Query } from '@apollo/react-components';
import { gql } from 'apollo-boost';
import { Provider, Subscribe } from 'react-contextual';
import { Route, Switch, Redirect } from 'react-router-dom';

import { PlayerContext } from '~/src/contexts/player';

const VIDEOS_QUERY = library => gql(`{ libraries(name: "${library}") { videos { name, path, metadata } } }`);

class Videos extends React.Component {
  state = {};
  render() {
    return (<>
      <Query query={VIDEOS_QUERY(this.props.libraryName)} client={window.apollo}>
        {({ loading, error, data }) => {
          if (loading)
            return (<div>Loading...</div>);
          if (error)
            return (<H5>{error.toString()}</H5>);

          const { libraries: [{ videos }] } = data;

          return videos.map(({name, path}) => (
            <Card key={name} css={{margin: '2em'}} onClick={() => this.context.play(path/*, 'application/dash+xml'*/)} interactive={true} elevation={Elevation.TWO}>
                <H5>{name}</H5>
                <Text ellipsize={true}>{path}</Text>
            </Card>
          ));
        }}
      </Query>
    </>);
  }
  static contextType = PlayerContext;
}


export default class Library extends React.Component {
  state = {};
  render() {
    const {match: {params: {name}}} = this.props;
    return (<div>
      <Videos libraryName={name}/>
    </div>);
  }
}
