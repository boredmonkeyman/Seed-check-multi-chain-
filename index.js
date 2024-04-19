const { ethers } = require('ethers')
const axios = require('axios')
const bip39 = require('bip39')
const moment = require('moment')
const cheerio = require('cheerio')
const fs = require('fs-extra')
require('colors')

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function logger(message, type) {
  switch (type) {
    case 'info':
      console.log(`[${moment().format('HH:mm:ss')}] ${message}`)
      break
    case 'success':
      console.log(`[${moment().format('HH:mm:ss')}] ${message}`.green)
      break
    case 'error':
      console.error(`[${moment().format('HH:mm:ss')}] ${message}`.red)
      break
    case 'warning':
      console.warn(`[${moment().format('HH:mm:ss')}] ${message}`.yellow)
      break
    default:
      console.log(`[${moment().format('HH:mm:ss')}] ${message}`)
  }
}

function scrapeBlockscan(address, type = 'etherscan') {
  const url = `https://${type}.com/address/${address}`
  return axios.get(url)
    .then(response => {
      const $ = cheerio.load(response.data)
      const balance = $('#ContentPlaceHolder1_divSummary > div.row.g-3.mb-4 > div:nth-child(1) > div > div > div:nth-child(3)').text()
      const balanceResult = balance.split('\n')[4]
      return balanceResult !== undefined ? balanceResult : '$0.00'
    })
    .catch(async () => {
      await delay(10000)
      return '$0.00'
    })
}

async function runBruteforce() {
  try {
    const seedPhrases = await fs.readFile('data.txt', 'utf-8')
    const seedList = seedPhrases.split('\n').filter(seed => seed.trim() !== '')

    for (const seed of seedList) {
      try {
        const wallet = ethers.Wallet.fromPhrase(seed.trim()) // Trim any whitespace from the seed phrase
        const ethAddress = wallet.address

        const [ethBalance, bnbBalance, maticBalance] = await Promise.all([
          scrapeBlockscan(ethAddress, 'etherscan'),
          scrapeBlockscan(ethAddress, 'bscscan'),
          scrapeBlockscan(ethAddress, 'polygonscan')
        ])

        logger(`👾 Address: ${ethAddress}`, 'info')
        logger(`💬 Mnemonic: ${seed}`, 'info')
        logger(`🔑 Private key: ${wallet.privateKey}`, 'info')
        logger(`🤑 ETH Balance: ${ethBalance}`, 'info')
        logger(`🤑 BNB Balance: ${bnbBalance}`, 'info')
        logger(`🤑 MATIC Balance: ${maticBalance}`, 'info')

        if (parseFloat(ethBalance.replace('$', '').replace(',', '')) > 1 ||
            parseFloat(bnbBalance.replace('$', '').replace(',', '')) > 1 ||
            parseFloat(maticBalance.replace('$', '').replace(',', '')) > 1) {
          logger(`🎉 Found a wallet with a non-zero balance!`, 'success')
          await fs.appendFile('wallets.txt', `👾 Address: ${ethAddress}\n💬 Mnemonic: ${seed}\n🔑 Private key: ${wallet.privateKey}\n🤑 ETH Balance: ${ethBalance}\n🤑 BNB Balance: ${bnbBalance}\n🤑 MATIC Balance: ${maticBalance}\n\n`)
        } else {
          logger(`👎 No luck this time.`, 'warning')
        }
      } catch (error) {
        logger(`An error occurred: ${error.message}`, 'error')
      }
      await delay(1000)
    }
  } catch (error) {
    logger(`Error reading seed phrases from file: ${error.message}`, 'error')
  }
}

runBruteforce()
