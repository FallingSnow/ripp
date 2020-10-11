import React from 'react';
import { FormGroup, H3, H4, H5, InputGroup, Tag, Button, Icon, Menu as BMenu, MenuItem, MenuDivider, Elevation, Switch } from "@blueprintjs/core";
import { Route, Switch as RSwitch, Redirect, withRouter } from 'react-router-dom';
import { useQuery, useLazyQuery } from '@apollo/react-hooks';
import { gql } from 'apollo-boost';

import {ErrorMessage} from '~/src/components/*';

class Overview extends React.Component {
  render() {
    return (
      <H3>Welcome to settings</H3>
    );
  }
}
class Server extends React.Component {
  state = {};
  setDefaultServer = async (e) => {
    e.preventDefault();
    const {hostname, port, secure} = Object.fromEntries(new FormData(e.target));
    let serverUrl = new URL(`http${secure ? 's' : ''}://${hostname}:${port}`);
    localStorage.serverUrl = serverUrl;
    await this.testConnection();
  }
  static connectionStrings = {
    'success': "Valid",
    'danger': "Unsuccessful",
    undefined: "Status Unknown"
  }
  async testConnection() {
    try {
      const response = await fetch(`${localStorage.serverUrl}info`);
      if (!response.ok)
        throw new Error(await response.text())
      this.setState({connectionStatus: 'success'});
    } catch (error) {
      console.error(error);
      this.setState({connectionStatus: 'danger'});
    }
  }
  async componentDidMount() {
    await this.testConnection();
  }
  render() {
    const connectionStatusString = Server.connectionStrings[this.state.connectionStatus];
    const {hostname, port, protocol} = new URL(localStorage.serverUrl);

    return (
      <div>
        <H3>Setup</H3>
        <form onSubmit={this.setDefaultServer}>
            <FormGroup
                label="Hostname"
                labelFor="hostname"
                labelInfo="(required)"
            >
                <InputGroup id="hostname" defaultValue={hostname} name="hostname" placeholder="localhost" />
            </FormGroup>
            <FormGroup
                label="Port"
                labelFor="port"
                labelInfo="(required)"
            >
                <InputGroup id="port" name="port" placeholder="1337" defaultValue={port} />
            </FormGroup>
            <FormGroup
                label="Options"
            >
                <Switch name="secure" label="SSL/TLS" defaultChecked={protocol.startsWith('https')} />
            </FormGroup>
            <FormGroup>
              <Tag css={{textAlign: 'center'}} fill={true} intent={this.state.connectionStatus}>Connection {connectionStatusString}</Tag>
            </FormGroup>
            <FormGroup css={{textAlign: 'right'}}>
              <Button type="submit" intent="primary" rightIcon="new-link">
                Connect
              </Button>
            </FormGroup>
        </form>
      </div>
    );
  }
}
function LibraryList({history}) {
  const { loading, error, data } = useQuery(gql`{ libraries { name, count } }`);

  if (loading)
    return <H5>Loading...</H5>;
  if (error)
    return <ErrorMessage error={error}/>;

  const { libraries } = data;

  const libraryItems = libraries.map(({name, count}) => (
    <MenuItem key={name} icon="home" label={count} text={name}>
      <MenuItem text="Delete" icon="trash" />
    </MenuItem>
  ));

  return (
    <BMenu css={{borderRadius: 0}}>
        {libraryItems}
    </BMenu>
  );
}
class Libraries extends React.Component {
  state = {};

  render() {
    const {history} = this.props;
    return (
      <div css={{padding: '2em'}}>
        <H4>Library List <Button onClick={() => history.push('/libraries/create')} className="bp3-minimal" icon="add" title="Create Library" /></H4>
        <LibraryList/>
      </div>
    );
  }
}

const Menu = withRouter(({history}) => (
  <BMenu css={{boxShadow: '0 0 0 1px rgba(16,22,26,.2)', borderRadius: 0, height: '100%'}}>
      <MenuItem icon="home" text="Overview" onClick={() => history.push('/settings')} />
      <MenuItem icon="book" text="Libraries" onClick={() => history.push('/settings/libraries')} />
      <MenuItem icon="globe" text="Sharing" onClick={() => history.push('/settings/sharing')}/>
      <MenuItem icon="ninja" text="Transcoder" onClick={() => history.push('/settings/transcoder')}/>
      <MenuItem icon="console" text="Server" onClick={() => history.push('/settings/server')}/>
      <MenuDivider />
      <MenuItem icon="flame" labelElement={<Icon icon="share" />} text="RIPP" />
  </BMenu>
));

export default class Settings extends React.Component {
  state = {};
    render() {
        return (<div css={{
          display: 'flex',
          flexDirection: 'row',
          height: '100%'
        }}>
          <Menu/>
          <RSwitch css={{flex: 1}}>
            <Route exact path="/settings" component={Overview}/>
            <Route exact path="/settings/server" component={Server}/>
            <Route exact path="/settings/libraries" component={Libraries}/>
          </RSwitch>
        </div>);
    }
}
