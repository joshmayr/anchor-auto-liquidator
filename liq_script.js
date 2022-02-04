const { LCDClient, Wallet, MnemonicKey, MsgExecuteContract } = require('@terra-money/terra.js');
const { columbus5, AddressProviderFromJson, fabricateLiquidationQueueSubmitBid, fabricateCw20Send } = require('@anchor-protocol/anchor.js');
const secrets = require('./secrets.json');
const {buildExecuteMsg, sendMsg, sleep} = require('./utils');

const terra = new LCDClient({
	URL: 'https://lcd.terra.dev',
	chainID: 'columbus-5'
 });
const owner = new MnemonicKey({
	mnemonic:
		secrets.mnemonic,
  });
const wallet = new Wallet(terra, owner);

// Anchor smart contract addresses
const anchorAddressProvider = new AddressProviderFromJson(columbus5);

//Enter Liquidation Queue
const buildSubmitBidMsg = async (amount) => { // TODO: Make the other options variables
	
	return fabricateLiquidationQueueSubmitBid({
		address: owner.accAddress,
		collateral_token: anchorAddressProvider.bLunaToken(), // Cw20 token contract address of bidding collateral
		premium_slot: 3, // Bid for a 4% discount
		amount: amount, // Amount to bid
		denom: 'uusd'
	})(anchorAddressProvider)
}

// Get User Bids
const queryUserBids = async () => {
	return await terra.wasm.contractQuery(
		anchorAddressProvider.liquidationQueue(), // TODO: Set this as a variable, for anchorLiquidationQueueContractAddress
		{
		  "bids_by_user": {
			"collateral_token": anchorAddressProvider.bLunaToken(), // TODO: Set to a variable
			"bidder": owner.accAddress,
		  }
		}
	);
}

const getCoinBalance = async (denom) => {
	const balances = await terra.bank.balance(owner.accAddress);
	try {
		const balance = balances[0]["_coins"][denom]["amount"];
		return balance;
	} catch {
		return "0";
	}
}

// What does the full process look like for Anchor liquidations?
// If we have UST in our account (greater than some amount), enter the liquidation queue


// We want this code to be asynchronous, but we can only do one transaction at a time (might not be true)
// I could setup mutex's for contract executions, or just have it loop and async which will be less efficient

// 1) If we have UST in our account, enter liquidation queue
// 2) If we have bids that can be activated, activate them
// 3) If we have bids that have been filled, claim them and convert them back to UST
// 4) Make all three of the above constantly loop, probably with some waiting period in between

// We don't really need these to happen sequentially, but I don't think we want multiple transactions to be happening at the same time because I think it can cause nonce issues


// For now I am going to assume that there won't be issues with the three processes happening in parallel
// If there are, I will either implement mutex's OR will make it async

// 1) Enter liquidation queue
const enterLiquidationQueue = async (minimumUusdBalance) => {
	const uusdBalance = await getCoinBalance('uusd');
	if(parseInt(uusdBalance) > minimumUusdBalance) { // If our wallet has at least 100 UST
		const parsedUSTBalance = (parseInt(uusdBalance) / 1_000_000).toString();
		const bidMsg = await buildSubmitBidMsg(parsedUSTBalance);
		const bidTx = await sendMsg(terra, wallet, bidMsg);
		return bidTx;
	}
	return "Not enough UST, no new bids";
}
// enterLiquidationQueue(10_000_000);

// 2) Check for bids to activate
const activateBids = async () => {
	const userBids = await queryUserBids();
	const currentTime = Math.floor(Date.now() / 1000);
	if(userBids.bids.length > 0) {
		for(i = 0; i < userBids.bids.length; i++) {
			if((userBids.bids[i].wait_end != 0 && userBids.bids[i].wait_end != null) && userBids.bids[i].wait_end < currentTime) {
				console.log(userBids);
				await activateBidsMsg()
				.then((activateBidsMsg) => {sendMsg(terra, wallet, activateBidsMsg)
					.then((txReceipt) => {
						console.log(txReceipt)
					}
				)})
				break;
			}
		}
	}
}
// activateBids();

// 3) Check for liquidations to claim



const claimLiquidations = async () => {
	const userBids = await queryUserBids();
	for(i = 0; i < userBids.bids.length; i++) {
		if(userBids.bids[i].pending_liquidated_collateral > 0) {
			const claimLiquidationsActions = {
			  "claim_liquidations": {
				"collateral_token": anchorAddressProvider.bLunaToken(), // TODO: Make this a variable for bLUNA or bETH
			  }
			}
			await buildExecuteMsg(owner.accAddress, anchorAddressProvider.liquidationQueue(), claimLiquidationsActions)
			.then(
				(claimLiquidationsMsg) => {sendMsg(terra, wallet, claimLiquidationsMsg)
					.then((claimLiquidationsTxReceipt) => {
						console.log(claimLiquidationsTxReceipt)
					}
				)
			})
			break;
		}
	}
}



// TODO: Write the functions for activating bids and claiming liquidations
const activateBidsMsg = async () => {
	return [
		new MsgExecuteContract(owner.accAddress, anchorAddressProvider.liquidationQueue(), {
			  "activate_bids": {
				"collateral_token": anchorAddressProvider.bLunaToken(), // TODO: Make this a var to allow for either bLUNA or bETH liquidations
			  }
			})
	]
}


async function main() {
	while(true) {
		await enterLiquidationQueue(1_000_000); // Still have to make sure we keep a little bit on UST in our account (Enough UST to keep us above zero, but below the minimum UST required to create a new bid)
		// We will only use this script with a wallet that is running this strategy, so we can let our UST go to zero, but not our LUNA because LUNA is how we pay for transactions
		await activateBids();
		await claimLiquidations();
		//await sleep(60_000); // Sleep for 60 seconds
		break;
	}
}

// TODO: Need to test how we will know that there are bids that can be activated
// After that, as long as all of the execution functions work, we should be finished
// Then it is a matter of stitching this code with the Astroport swap code
// Then we just need to clean up all of the code so that it is easier to read, more maintainable, more modular

main()