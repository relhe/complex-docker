import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import OtherPage from "./OtherPage";
import Fib from "./Fib";

function NavLink({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`nav-link${isActive ? " active" : ""}`}>
      {children}
    </Link>
  );
}

function Layout() {
  return (
    <div className="App">
      <nav className="navbar">
        <Link to="/" className="navbar-brand">
          <div className="navbar-icon">&#8721;</div>
          <span className="navbar-title">Fib<span>Calc</span></span>
        </Link>
        <div className="navbar-nav">
          <NavLink to="/">Calculator</NavLink>
          <NavLink to="/otherpage">About</NavLink>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Fib />} />
        <Route path="/otherpage" element={<OtherPage />} />
      </Routes>

      <footer className="footer">
        FibCalc &mdash; Distributed Fibonacci via Docker microservices
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Layout />
    </Router>
  );
}

export default App;
