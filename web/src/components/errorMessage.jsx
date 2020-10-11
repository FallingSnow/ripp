import React from 'react';
import { H5, Text } from "@blueprintjs/core";

const COLOR = '#f44336';
const COLOR_LIGHT = '#ef5350';

export default class ErrorMessage extends React.Component {
  render() {
    const {error: {message, stack}} = this.props;
    return (<div css={{borderLeft: `1px solid ${COLOR}`, padding: '1em'}}>
      <H5 css={{color: COLOR}}>{message}</H5>
      <hr css={{borderBottomColor: COLOR, borderTop: 0, marginLeft: '-1em'}}/>
      <pre css={{color: COLOR_LIGHT, fontSize: '0.9em'}}>{stack}</pre>
    </div>);
  }
}
