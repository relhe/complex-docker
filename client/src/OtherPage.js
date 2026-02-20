import React from "react";
import { Link } from "react-router-dom";

const OtherPage = () => {
  return (
    <div className="other-page">
      <div className="other-page-icon">&#9881;</div>
      <h2>About This App</h2>
      <p>
        A demo of Docker-based microservices — React frontend, Node API,
        Redis worker, and PostgreSQL — all orchestrated together.
      </p>
      <Link to="/" className="btn-ghost">
        &#8592; Back to Calculator
      </Link>
    </div>
  );
};

export default OtherPage;
