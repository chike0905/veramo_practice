import {
  createAgent,
  IMessageHandler,
  IResolver,
  MinimalImportableIdentifier,
  MinimalImportableKey,
  VerifiableCredential
} from '@veramo/core';
import { DIDManager } from '@veramo/did-manager'
import { EthrDIDProvider } from '@veramo/did-provider-ethr';
import { KeyManager } from '@veramo/key-manager';
import { KeyManagementSystem, SecretBox } from '@veramo/kms-local'

import { Entities, KeyStore, DIDStore, PrivateKeyStore, migrations } from '@veramo/data-store'
import { createConnection } from 'typeorm'

import { IDIDManager, IKeyManager } from '@veramo/core';

// resolver
import { DIDResolverPlugin } from '@veramo/did-resolver'
import { Resolver } from 'did-resolver'
import { getResolver as ethrDidResolver } from 'ethr-did-resolver'

// Verifiable Credentials
import {
  CredentialIssuer,
  ICreateVerifiableCredentialArgs,
  ICreateVerifiablePresentationArgs
} from '@veramo/credential-w3c';
import { ICredentialIssuer } from '@veramo/credential-w3c'
/// Verifier
import { MessageHandler } from "@veramo/message-handler";
import { W3cMessageHandler } from "@veramo/credential-w3c";
import { JwtMessageHandler } from "@veramo/did-jwt";

// utils
import { computePublicKey } from '@ethersproject/signing-key';
import { computeAddress } from '@ethersproject/transactions';


const DATABASE_FILE = 'database.sqlite';
const KMS_SECRET_KEY = '9098cd3c5449083c36678295780e57d4d05dbdfa56a22eb3a2b960d85e6d2abe';

const dbConnection = createConnection({
  type: 'sqlite',
  database: DATABASE_FILE,
  synchronize: false,
  migrations,
  migrationsRun: true,
  logging: ['error', 'info', 'warn'],
  entities: Entities,
})

const setup = (rpc: string, registry: string) => {
  const keyManager = new KeyManager({
    store: new KeyStore(dbConnection),
    kms: {
      local: new KeyManagementSystem(
        new PrivateKeyStore(dbConnection, new SecretBox(KMS_SECRET_KEY))
      ),
    },
  });

  const providerConfiguration = {
    defaultKms: 'local',
    network: 1337,
    rpcUrl: rpc,
    registry: registry
  }

  const ethrProvider = new EthrDIDProvider(providerConfiguration);

  const didManager = new DIDManager({
    defaultProvider: 'did:ethr',
    providers: {
      'did:ethr': ethrProvider
    },
    store: new DIDStore(dbConnection),
  });

  const didResolver = new DIDResolverPlugin({
    resolver: new Resolver({
      ...ethrDidResolver({ networks: [{ ...providerConfiguration, name: '1337' }] }),
    }),
  });

  const agent = createAgent<IDIDManager & IKeyManager & ICredentialIssuer>({
    plugins: [
      keyManager,
      didManager,
      didResolver,
      new CredentialIssuer()
    ]
  });
  return agent;
}

const main = async (rpc: string, registry: string, privateKey: string) => {
  let res: any;
  const agent = setup(rpc, registry);

  const pubkey = computePublicKey('0x' + privateKey)
  const address = computeAddress(pubkey);
  const keyObj: MinimalImportableKey = {
    kms: 'local',
    privateKeyHex: privateKey,
    type: 'Secp256k1',
    kid: pubkey
  }

  const did = "did:ethr:1337:" + address

  const newDidObj: MinimalImportableIdentifier = {
    keys: [keyObj],
    provider: 'did:ethr',
    did,
    controllerKeyId: pubkey
  };

  res = await agent.didManagerImport(newDidObj);

  // console.log('did:', res);

  // add key
  const key = await agent.keyManagerCreate({ kms: 'local', type: 'Secp256k1' });
  await agent.didManagerAddKey({ did, key, options: {} });

  // // set service
  // await agent.didManagerAddService({
  //   did: veramoDid.did,
  //   service: {
  //     id: 'hogehoge',
  //     serviceEndpoint: 'http://chike.xyz',
  //     type: 'test'
  //   },
  //   options: {}
  // })
  //   .catch((e: any) => {
  //     console.error(e);
  //     return;
  //   });

  // // resolve
  // res = await agent.resolveDid({
  //   didUrl: "did:ethr:1337:" + address
  // })
  // console.log(JSON.stringify(res, null, 2));

  // Issue Verifiable Credential
  const vcSubject = {
    issuer: { id: did },
    credentialSubject: {
      id: 'Ryosuke Abe',
      work: 'himo',
    },
    termsOfUse: 'For Neta'
  };

  const vcIssueArgs: ICreateVerifiableCredentialArgs = {
    credential: vcSubject,
    proofFormat: 'jwt',
    save: false
  };

  const vc: VerifiableCredential = await agent.createVerifiableCredential(vcIssueArgs)
  console.log('vc:', vc);


  const providerConfiguration = {
    defaultKms: 'local',
    network: 1337,
    rpcUrl: rpc,
    registry: registry
  }
  const verifierAgent = createAgent<IResolver & IMessageHandler>({
    plugins: [
      new DIDResolverPlugin({
        resolver: new Resolver({
          ...ethrDidResolver({ networks: [{ ...providerConfiguration, name: '1337' }] }),
        })
      }),
      new MessageHandler({
        messageHandlers: [new JwtMessageHandler(), new W3cMessageHandler()],
      }),
    ],
  });
  const vcMessage = await verifierAgent.handleMessage({
    raw: vc.proof.jwt
  });
  console.log(vcMessage);

  // Create Presentation
  const createVpArgs: ICreateVerifiablePresentationArgs = {
    presentation: {
      holder: did,
      verifier: [did],
      verifiableCredential: [vc],
      type: ['VerifiablePresentation'],
    },
    proofFormat: 'jwt',
  }
  const vp = await agent.createVerifiablePresentation(createVpArgs);
  console.log(vp)
  const vpMessage = await verifierAgent.handleMessage({
    raw: vp.proof.jwt
  });
  console.log(vpMessage);
}

export default main;