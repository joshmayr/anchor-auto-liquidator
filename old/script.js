const { LCDClient, MsgSend, MnemonicKey, Coin } = require('@terra-money/terra.js');
const secrets = require('./secrets.json');

// create a key out of a mnemonic
const mk = new MnemonicKey({
    mnemonic:
      secrets.mnemonic,
  });

// connect to bombay testnet
const terra = new LCDClient({
  URL: 'https://bombay-lcd.terra.dev',
  chainID: 'bombay-12',
});

// To use LocalTerra
// const terra = new LCDClient({
//   URL: 'http://localhost:1317',
//   chainID: 'localterra'
// });

// get the current swap rate from 1 TerraUSD to TerraKRW
const offerCoin = new Coin('uusd', '1000000');
terra.market.swapRate(offerCoin, 'ukrw').then(c => {
  console.log(`${offerCoin.toString()} can be swapped for ${c.toString()}`);
});

// a wallet can be created out of any key
// wallets abstract transaction building
const wallet = terra.wallet(mk);

// create a simple message that moves coin balances
const send = new MsgSend(
  'terra1x46rqay4d3cssq8gxxvqz8xt6nwlz4td20k38v',
  'terra17lmam6zguazs5q5u6z5mmx76uj63gldnse2pdp',
  { uluna: 1000000, ukrw: 1230201, uusd: 1312029 } // send 1 Luna, 1.23KRT, 1.31 UST
);


const query = async () => {
    wallet
  .createAndSignTx({
    msgs: [send],
    memo: 'test from terra.js!',
  })
  .then(tx => terra.tx.broadcast(tx))
  .then(result => {
    console.log(`TX hash: ${result.txhash}`);
  });

  const result = await terra.wasm.contractQuery(
    contract_address[0],
    { query: { queryMsgArguments } } // query msg
  );
}
//query();
