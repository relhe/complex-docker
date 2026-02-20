import React, { Component } from "react";
import axios from "axios";

class Fib extends Component {
  state = {
    seenIndexes: [],
    values: {},
    index: "",
  };

  componentDidMount() {
    this.fetchValues();
    this.fetchIndexes();
    this._poll = setInterval(() => {
      this.fetchValues();
      this.fetchIndexes();
    }, 1500);
  }

  componentWillUnmount() {
    clearInterval(this._poll);
  }

  async fetchValues() {
    const values = await axios.get("/api/values/current");
    this.setState({ values: values.data });
  }

  async fetchIndexes() {
    const seenIndexes = await axios.get("/api/values/all");
    this.setState({ seenIndexes: seenIndexes.data });
  }

  handleSubmit = async (event) => {
    event.preventDefault();
    await axios.post("/api/values", { index: this.state.index });
    this.setState({ index: "" });
  };

  renderSeenIndexes() {
    if (!this.state.seenIndexes.length) {
      return <span className="empty-state">No indexes submitted yet</span>;
    }
    return this.state.seenIndexes.map(({ number }) => (
      <span key={number} className="pill">{number}</span>
    ));
  }

  renderValues() {
    const entries = [];
    for (let key in this.state.values) {
      entries.push(
        <div key={key} className="result-row">
          <span className="result-index">Index <strong>{key}</strong></span>
          <span className="result-value">{this.state.values[key]}</span>
        </div>
      );
    }
    if (!entries.length) {
      return <span className="empty-state">No results yet — submit an index above</span>;
    }
    return <div className="results-list">{entries}</div>;
  }

  render() {
    return (
      <div className="main-content">
        <div className="page-header">
          <h1>Fibonacci Calculator</h1>
          <p>Enter an index to compute its Fibonacci number via distributed workers</p>
        </div>

        <div className="status-bar">
          <div className="status-dot" />
          API connected &mdash; results are cached in Redis and persisted to PostgreSQL
        </div>

        <div className="card">
          <p className="card-title">Compute</p>
          <form className="calc-form" onSubmit={this.handleSubmit}>
            <div className="input-group">
              <label className="input-label" htmlFor="fib-index">Fibonacci Index</label>
              <input
                id="fib-index"
                className="calc-input"
                type="number"
                min="0"
                placeholder="e.g. 10"
                value={this.state.index}
                onChange={(e) => this.setState({ index: e.target.value })}
              />
            </div>
            <button className="btn-primary" type="submit">Calculate</button>
          </form>
        </div>

        <div className="card">
          <p className="card-title">Indexes Seen</p>
          <div className="index-pills">
            {this.renderSeenIndexes()}
          </div>
        </div>

        <div className="card">
          <p className="card-title">Calculated Values</p>
          {this.renderValues()}
        </div>
      </div>
    );
  }
}

export default Fib;
