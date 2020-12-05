require('dotenv').config();
require('cross-fetch/polyfill');

const { ApolloClient, InMemoryCache } = require('@apollo/client/core');
const { getTokenETHQuery, getUSDQuery } = require('./query');

const apolloClient = new ApolloClient({
  uri: process.env.GRAPHQL_API,
  cache: new InMemoryCache()
});

async function getTokenETH(symbol) {
  const { data } = await apolloClient.query({ query: getTokenETHQuery, variables: { symbol } });
  return Math.max.apply(Math, data.tokens.map(t => parseFloat(t.derivedETH)))
}

async function getUSD() {
  const { data } = await apolloClient.query({ query: getUSDQuery });
  return Math.max.apply(Math, data.tokens.map(t => parseFloat(t.derivedETH)))
}

module.exports = { getTokenETH, getUSD };
