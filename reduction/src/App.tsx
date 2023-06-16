import React, {Component} from 'react';
import logo from './logo.svg';
import './App.css';
import {Simulate} from "react-dom/test-utils";
import * as log from 'loglevel';

class App extends Component<{}, { hasError: boolean }> {
  public constructor(props: {}) {
    super(props);
    this.state = { hasError: false };
  }

  public componentDidCatch(error: Error | null): void {
    this.setState({ hasError: true });
    log.error(`Reduction error: ${error}`);
  }

  // handler(e: Event): void {
  //   // attempt to re-render the plugin if we get told to
  //   const action = (e as CustomEvent).detail;
  //   if (action.type === RequestPluginRerenderType) {
  //   this.forceUpdate();
  // }
  // }
  //
  // public componentDidMount(): void {
  //   document.addEventListener(MicroFrontendId, this.handler);
  // }
  //
  // public componentWillUnmount(): void {
  //   document.removeEventListener(MicroFrontendId, this.handler);
  // }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
          <div className="error">
            <div
                style={{
                  padding: 20,
                  background: 'red',
                  color: 'white',
                  margin: 5,
                }}
            >
              Something went wrong...
            </div>
          </div>
      );
    }
    return (
        <div className="App">
          <header className="App-header">
            <img src={logo} className="App-logo" alt="logo" />
              <p>
                Edit <code>src/App.tsx</code> and save to reload.
              </p>
              <a
                className="App-link"
                href="https://reactjs.org"
                target="_blank"
                rel="noopener noreferrer"
              >
              Learn React
              </a>
          </header>
        </div>
    );
  }
}

export default App;
