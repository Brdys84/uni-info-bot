const { gql } = require('@apollo/client/core');

const getTokenETHQuery = gql`
  query GetETH($symbol: String!) {
    tokens(where: {symbol: $symbol}) {
      derivedETH
    }
  }
`;

const getUSDQuery = gql`
  query GetUSD {
    tokens(where: {symbol: "TUSD"}) {
      derivedETH
    }
  }
`;

module.exports = { getTokenETHQuery, getUSDQuery };
