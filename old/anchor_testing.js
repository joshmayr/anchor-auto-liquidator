const {fabricateMarketRedeemStable, fabricateMarketDepositStableCoin, bombay12, AddressProviderFromJson, fabricateLiquidationQueueSubmitBid, } = require('@anchor-protocol/anchor.js');
const { LCDClient, Wallet, MnemonicKey, StdFee} = require('@terra-money/terra.js');
//import { Anchor, columbus5, AddressProviderFromJson, MARKET_DENOMS, OperationGasParameters } from '@anchor-protocol/anchor.js'
const secrets = require('./secrets.json');

const anchor = new LCDClient({ URL: 'https://bombay-lcd.terra.dev', chainID:'bombay-12' });
const owner = new MnemonicKey({mnemonic: secrets.mnemonic});
const wallet = new Wallet(anchor, owner);
/*
const walletAddress = async () => {
    console.log(await wallet.accountNumber());
    console.log(await owner.accAddress);
    console.log("TEST");
    exit(1);
}
walletAddress();
*/

// default -- uses bombay core contract addresses
const addressProvider = new AddressProviderFromJson(bombay12);
const redeemMsg = fabricateMarketRedeemStable({
    address: owner.accAddress,
    market: 'usd',
    amount: '10000',
  })(addressProvider);

const depositMsg = fabricateMarketDepositStableCoin({
  address: owner.accAddress,
  symbol: 'usd',
  amount: '10',
})(addressProvider);

const submitBidMsg = fabricateLiquidationQueueSubmitBid({
    address: owner.accAddress,
    collateral_token: addressProvider.bLunaToken(), // Cw20 token contract address of bidding collateral
    premium_slot: 4,
    amount: '1000',
    denom: 'uusd'
})(addressProvider);

const getBalance = async (denom) => {
    const balances = await anchor.bank.balance(owner.accAddress);
    const balance = balances[0]["_coins"][denom]["amount"];
    console.log(balance);
    return balance;
}
getBalance("uusd");

async function depositStable() {
    // Need to send the funds first
    const tx = await wallet.createAndSignTx({
        msgs: depositMsg,
    });
    return await anchor.tx.broadcast(tx);
}

async function submitBid() {
    const tx = await wallet.createAndSignTx({
        msgs: submitBidMsg,
    });
    return await anchor.tx.broadcast(tx);
}
    
async function main() {
    //await depositStable();
    await submitBid();
}
    
main().catch(console.error);
