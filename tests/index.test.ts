const ganache = require('ganache-cli');
import { ethers } from "ethers";
import * as fs from 'fs';

import main from '../src/index';

// -------- Test Config ------
const ACCOUNTS = {
  Sender: {
    Address: ethers.utils.getAddress('0xB2f0b48736D868E24DFdA5034DFC688FaDeC0F19'),
    PrivateKey: '2e61ecd84e20a343231f82e0b89067d32c4fb26e8db1af65e071edcc96ad2f34',
  },
  Receiver: {
    Address: ethers.utils.getAddress('0xc1255Ab675404c5179595923CCfCDc1aeFdAD8b9'),
    PrivateKey: 'bb700e968fad7bb544c2f355eab457cc67aeff4f9a48c2f18556b2dda4b5e976',
  }
}

const NODE_URL = 'http://localhost'

const GANACHE_OPTIONS = {
  network_id: 11451,
  accounts: [{
    secretKey: '0x' + ACCOUNTS.Sender.PrivateKey,
    balance: 100000000000000000000,
  },
  {
    secretKey: '0x' + ACCOUNTS.Receiver.PrivateKey,
    balance: 100000000000000000000,
  }]
};

// -------- Utils ------
class GanacheEnv {
  public server;
  public port: number;
  public urlWithPort: string;
  constructor(port: number, nodeUrl: string = NODE_URL) {
    this.port = port;
    this.server = ganache.server(GANACHE_OPTIONS);
    this.urlWithPort = `${nodeUrl}:${this.port}`;
  }
}

function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

const setUpGanache = async () => {
  const port: number = getRandomInt(10000, 15000);
  const env = new GanacheEnv(port);
  await env.server.listen(env.port, (err: any) => {
    if (err) throw err;
  });
  return env;
};

const setUpDIDRegistry = async () => {
  const registryJson = require('ethr-did-registry/build/contracts/EthereumDIDRegistry.json')
  const rawTx = {
    nonce: 0,
    gasPrice: 10000000000, // 10 Gwei
    gasLimit: 2000000,
    value: 0,
    data: registryJson.bytecode
  }
  let provider = ethers.getDefaultProvider(env.urlWithPort);
  let wallet = new ethers.Wallet('0x' + ACCOUNTS.Sender.PrivateKey, provider);
  const txRes = await wallet.sendTransaction(rawTx);
  const receipt = await provider.getTransactionReceipt(txRes.hash);
  const registry = receipt.contractAddress;
  return registry;
}

// ------ Setup/Teardown ------
let env: GanacheEnv;
let registry: string;
beforeEach(async () => {
  env = await setUpGanache();
  registry = await setUpDIDRegistry();
});

afterEach(async () => {
  await env.server.close();
  fs.unlinkSync('database.sqlite');
});

// ------ TEST BODY ------
it('hoge', async () => {
  await main(env.urlWithPort, registry, ACCOUNTS.Sender.PrivateKey);
});
