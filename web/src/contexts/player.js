import React, { createContext } from 'react';

export const PlayerContext = createContext();

export class PlayerProvider extends React.Component {
  state = {
    path: '',
    type: '',
    subtitleIdx: null,
    audioIdx: null,
    play: (path, type = 'application/x-mpegURL') => {
      console.debug(`VideoContext: Playing`, path);
      this.setState({path, type: 'application/x-mpegURL'});
    }
  }
  render() {
    return <PlayerContext.Provider value={this.state}>
      {this.props.children}
    </PlayerContext.Provider>
  }
}
