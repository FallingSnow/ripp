import React from 'react';
import {hot} from 'react-hot-loader/root';
// import {Helmet} from "react-helmet";
import {BrowserRouter as Router, Route, Switch, Redirect, Link, withRouter} from 'react-router-dom';
import ApolloClient from 'apollo-boost';
import { ApolloProvider } from '@apollo/react-hooks';
import { Navbar, Button, Breadcrumbs, Breadcrumb, Card } from "@blueprintjs/core";
import videojs from 'video.js';
import 'video.js/dist/video-js.min.css';
import subtitlesOctopus from 'libass-wasm';

import * as pages from './pages';
import { PlayerContext, PlayerProvider } from './contexts/player';

window.apollo = new ApolloClient({
  uri: localStorage.serverUrl + 'gql',
  headers: {
    authorization: 'Bearer 123'
  }
});

class FourOhFour extends React.Component {
    render() {
        const page = this.props.location.state ? this.props.location.state.pathname : "Page";
        return (<h1>404: {page} not found</h1>);
    }
}

const Paths = withRouter(({location: {pathname}}) => {
  return (
    <div css={{height: '100%', overflow: 'auto'}}>
      <Switch>
        <Route exact path="/" component={pages.Home}/>
        <Route exact path="/not-found" component={FourOhFour}/>
        <Route exact path="/setup" component={pages.Setup}/>
        <Route path="/libraries" component={pages.Libraries}/>
        <Route path="/settings" component={pages.Settings}/>
        <Redirect to={{
                pathname: '/not-found',
                state: {
                  pathname
                }
            }}/>
      </Switch>
    </div>
  );
});

const Nav = withRouter(({history}) => {
  return (<Navbar>
    <Navbar.Group>
        <Navbar.Heading>RIPP</Navbar.Heading>
        <Navbar.Divider/>
        <Button onClick={() => history.push('/')} className="bp3-minimal" icon="home" title="Dashboard" />
        <Button onClick={() => history.push('/libraries')} className="bp3-minimal" icon="book" title="Libraries" />
        <Button onClick={() => history.push('/settings')} className="bp3-minimal" icon="cog" title="Settings" />
    </Navbar.Group>
  </Navbar>);
});

const renderBreadcrumb = withRouter(({ history, href, text, ...restProps }) => {
  return <Breadcrumb onClick={() => history.push(href)} {...restProps}>{text}</Breadcrumb>;
});

const Bread = withRouter(({history, location: {pathname}}) => {
  const crumbs = pathname
    .split('?')[0]
    // Remove trailing slash "/" from pathname.
    .replace(/^\/|\/$/, '')
    // Split pathname into crumbs.
    .split('/')
    .reduce((crumbs, crumb) => {
      const lastCrumb = crumbs.length ? crumbs[crumbs.length - 1] : {};
      crumbs.push({href: `${lastCrumb.href || ''}/${crumb}`, text: crumb.toLowerCase()});
      return crumbs;
    }, []);

  return (<Card elevation={0} css={{padding: '0.5em 15px'}}>
    <Breadcrumbs items={crumbs} breadcrumbRenderer={renderBreadcrumb} />
  </Card>);
});

class VideoPlayer extends React.Component {
  options = {
    autoplay: true,
    controls: true,
    liveui: true,
    liveTracker: true,
    html5: {
      hls: {
        controls: true,
        handleManifestRedirects: true,
        useBandwidthFromLocalStorage: true,
        handlePartialData: true,
        smoothQualityChange: true
      }
    }
  };
  componentDidMount() {
    console.debug("VideoPlayer mounted!");
    // Initialize Video.js
    this.player = videojs(this.videoNode, this.options);

    const {path, type, subtitleIdx} = this.props;
    this.play({path, type});

    const subUrl = (new URL(`/transcode/subtitle?path=${path}&index=${subtitleIdx}}`, localStorage.serverUrl)).toString();
    console.debug('Playing subtitle url:', subUrl);
    this.subtitleEngine = new subtitlesOctopus({
      video: this.videoNode,
      subUrl,
      workerUrl: require('!!file-loader!libass-wasm/dist/subtitles-octopus-worker.js')
    });

    // this.timer = setInterval(() => {
    //   console.log(this.player.tech({ IWillNotUseThisInPlugins: true }).hls)
    // }, 1000)
  }

  // Destroy player on unmount
  componentWillUnmount() {
    if (this.player) {
      this.player.dispose();
    }
    if (this.subtitleEngine) {
      this.subtitleEngine.dispose();
    }
  }
  loadAss({path, idx}) {

  }
  play({path, type}) {
    console.debug('VideoPlayer: Playing', {path, type});
    const src = (new URL(`/transcode/video?path=${path}&type=${encodeURIComponent(type)}`, localStorage.serverUrl)).toString();
    this.player.src({
      src,
      type
    });
  }
  componentDidUpdate(prevProps, prevState, snapshot) {
    const {src, type, state} = this.props;
    if (state !== prevProps.state) {
      if (state === 'playing')
        this.player.play();
      if (state === 'paused')
        this.player.pause();
    }
    if (src !== prevProps.state || type !== prevProps.state) {
      this.play({src, type});
    }
  }
  render() {
    return (
        <div data-vjs-player>
          <video ref={ node => this.videoNode = node } className="video-js"></video>
        </div>
    );
  }
}

class Video extends React.Component {
  render() {
    const { path, type, subtitleIdx, audioIdx } = this.context;
    return (<div css={{left: 0, position: 'fixed', bottom: 0, height: 100,
      '.video-js': {
        height: '100%',
        width: 'auto',
        '&.vjs-waiting': {
          width: 177.77778
        },
        'video': {
          outline: 'none',
        }
      },
      '.video-js:not(.vjs-fullscreen) > .vjs-tech': {
        width: 'auto'
      }
    }}>
      { path ? <VideoPlayer path={path} type={type} subtitleIdx={subtitleIdx} audioIdx={audioIdx}/> : null }
    </div>);
  }
  static contextType = PlayerContext;
}

class App extends React.Component {
  render() {
    return (
        <PlayerProvider>
          <div id="app" css={{
                  display: 'flex',
                  height: '100%',
                  overflow: 'hidden',
                  flexDirection: 'column',
                  fontFamily: 'Nunito',
                  fontSize: 14,
              }}>
            <Router basename={process.env.PUBLIC_PATH}>
              <Nav/>
              <Bread/>
              <Paths/>
              <Video/>
            </Router>
          </div>
        </PlayerProvider>
    );
  }
}

export default hot(App);
// export default App;
