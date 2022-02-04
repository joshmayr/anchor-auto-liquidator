const { LCDClient, Wallet, MnemonicKey, StdFee, MsgExecuteContract} = require('@terra-money/terra.js');
const secrets = require('./secrets.json');

//const terra = new LCDClient({ URL: 'https://bombay-lcd.terra.dev', chainID:'bombay-12' });
const terra = new LCDClient({
    URL: 'https://lcd.terra.dev',
    chainID: 'columbus-5'
 });
const owner = new MnemonicKey({
    mnemonic:
        secrets.mnemonic,
  });
const wallet = new Wallet(terra, owner);

const walletAddress = async () => {
    console.log(await owner.accAddress);
}
walletAddress();


// These are mainnet addresses, will need to create a new wallet and test on mainnet with a wallet that has a small amount of money
const astroportFactoryAddress = "terra1fnywlw4edny3vw44x04xd67uzkdqluymgreu7g";
const astroportRouterAddress = "terra16t7dpwwgx9n3lq6l6te3753lsjqwhxwpday9zx";
const bLUNATokenAddress = "terra1kc87mu460fwkqte29rquh4hc20m54fxwtsx7gp";

// Factory
// Get token pairs
// Query message:
// token: contract_address
// native_token: denom

// Router
// execute swap operations
// astro_swap:
// offer_asset_info: native_token/token
// ask_asset_info: native_token/token
// minimum receive
// astro_swap for bLUNA -> LUNA
// native swap for UST -> LUNA (I think)

// Query swap operations:
// simulate_swap_operations
// operations -> astro_swap -> offer_asset_info -> ask_asset_info, offer_amount

const getBalance = async (denom) => {
    const balances = await terra.bank.balance(owner.accAddress);
    const balance = balances[0]["_coins"][denom]["amount"];
    console.log(balance);
    return balance;
}
// getBalance("uusd");

const queryTrade = async () => {
    return [
        new MsgExecuteContract(owner.accAddress, astroportRouterAddress, {
            simulate_swap_operations: {
                "offer_amount": "10000000",
                "operations": [
                    {
                        "native_swap": {
                            "offer_denom": "ukrw",
                            "ask_denom": "uusd"
                        }
                    },
                    {
                        "astro_swap": {
                            "offer_asset_info": {
                                "native_token": {
                                    "denom": "uusd"
                                }
                            },
                            "ask_asset_info": {
                                "token": {
                                    "contract_addr": bLUNATokenAddress
                                }
                            }
                        }
                    }
                ]
            }
        })
    ]
}

// Swap bLUNA -> LUNA -> UST
const realQueryTrade = async() => {
    return await terra.wasm.contractQuery(
        astroportRouterAddress,
        {
            "simulate_swap_operations" : {
              "offer_amount": "123",
              "operations": [
              {
                "astro_swap": {
                  "offer_asset_info": {
                    "token": {
                      "contract_addr": "terra1kc87mu460fwkqte29rquh4hc20m54fxwtsx7gp"
                    }
                  },
                  "ask_asset_info": {
                    "native_token": {
                      "denom": "uluna"
                    }
                  }
                }
              },
              {
                "native_swap": {
                    "offer_denom": "uluna",
                    "ask_denom": "uusd"
                }
            }
            ]
            }
          }
      );
}
// Will return an error if the pool doesn't exist that we are trying to swap on 
// Do a query to simulate the response with what we have to offer
// Then do an execute query asking for 99% of what the simulation offer said we would receive

// TODO:
// 1) Create a new terra wallet
// 2) Send the new wallet $10 UST
// 3) Attempt to swap 9 UST for bLUNA
// Need to learn how it figures out how much money to remove from my wallet and what it sets the fees to...

async function main() {
    //await depositStable();
    //await submitBid();

    await realQueryTrade().then((result) => {
        console.log(result);
    });
}
    
main().catch(console.error);
