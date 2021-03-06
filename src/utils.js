const { MsgExecuteContract } = require('@terra-money/terra.js');


async function buildExecuteMsg(senderAddress, contractAddress, actions) {
	return [
		new MsgExecuteContract(senderAddress, contractAddress, actions)
	]
}

async function buildExecuteMsg(senderAddress, contractAddress, actions, coins) {
	return [
		new MsgExecuteContract(senderAddress, contractAddress, actions, coins)
	]
}

async function sendMsg(client, wallet, msg) {
	const tx = await wallet.createAndSignTx({
		msgs: msg,
	})
	return await client.tx.broadcast(tx);
}

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

module.exports = { buildExecuteMsg, sendMsg, sleep };