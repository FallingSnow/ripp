import React, { useState } from 'react';
import { Switch, Route } from 'react-router-dom';
import { Card, Elevation, H5, H2, FormGroup, Tag, InputGroup, Button, Tree } from "@blueprintjs/core";
import { useQuery, useLazyQuery } from '@apollo/react-hooks';
import { gql } from 'apollo-boost';

import Library from './library';
import Create from './create';
import {ErrorMessage} from '~/src/components/*';

function LibraryList({history}) {
  const { loading, error, data } = useQuery(gql`{ libraries { name } }`);

  if (loading)
    return <H5>Loading...</H5>;
  if (error)
    return <ErrorMessage error={error}/>;

  const { libraries } = data;

  return libraries.map(({name}) => (<Card key={name} css={{margin: '2em'}} onClick={() => history.push(`/libraries/${name.toLowerCase()}`)} interactive={true} elevation={Elevation.TWO}>
      <H5>{name}</H5>
  </Card>));
}

class Libraries extends React.Component {
  state = {};
  render() {
    const {history} = this.props;
    const videos = [];
    return (<div>
        <LibraryList history={history}/>
        <Button onClick={() => history.push('/libraries/create')}>Create Library</Button>
      </div>);
  }
}

export default function({match: {params: {name}}}) {
  const videos = [];
  return (<Switch>
    <Route exact path="/libraries" component={Libraries}/>
    <Route exact path="/libraries/create" component={Create}/>
    <Route exact path="/libraries/:name" component={Library}/>
  </Switch>);
}
