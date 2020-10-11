import React from 'react';
import { FormGroup, H2, InputGroup, Switch, Tag } from "@blueprintjs/core";
import { Button, Icon } from "@blueprintjs/core";

export default class Setup extends React.Component {
  state = {};
  setDefaultServer = (e) => {
    e.preventDefault();
    const {hostname, port, secure} = Object.fromEntries(new FormData(e.target));
    let serverUrl = new URL(`http${secure ? 's' : ''}://${hostname}:${port}`);
    localStorage.serverUrl = serverUrl;
    this.setState({connectionStatus: 'success'});
  }
  static connectionStrings = {
    'success': "Valid",
    'error': "Unsuccessful",
    undefined: "Status Unknown"
  }
    render() {
      const connectionStatusString = Setup.connectionStrings[this.state.connectionStatus];
      const {hostname, port, protocol} = new URL(localStorage.serverUrl);

        return (<div css={{
                overflow: 'auto',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'column'
            }}>
            <H2 css={{textAlign: 'center'}}>Server Setup</H2>
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
        </div>);
    }
}
