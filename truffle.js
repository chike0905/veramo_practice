const TestRPC = require("ganache-cli");

module.exports = {
  networks: {
    development: {
      provider: TestRPC.provider({ port: 7545 }),
      network_id: "*" // Match any network id
    },
    local: {
      host: "localhost",
      port: 8545,
      network_id: "*"
    }
  },
  compilers: {
    solc: {
      version: "^0.8.6"
    }
  }
};