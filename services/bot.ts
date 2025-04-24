import TelegramBot, { Message } from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN as string, { polling: false });

export function registerCommands() {

    bot.onText(/\/start/, (msg: Message) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, `👋 Hello ${msg.from?.first_name || 'there'}! Welcome to the Vybe Telegram Bot 🤖.\n\nType /help to see available commands.`);
    });

    // /help
    bot.onText(/\/help/, (msg: Message) => {
        const chatId = msg.chat.id;
        console.log(`[LOG] Help command requested by user ${msg.from?.id} (${msg.from?.username || 'unknown'})`);
        console.log(`[LOG] Chat ID: ${chatId}`);
        bot.sendMessage(chatId, `Here are the available commands:

<b>🔹 Basic Commands:</b>
/start - <i>Start interacting with the bot</i>
/help - <i>View all available commands</i>
/echo [text] - <i>Repeat your text</i>
/time - <i>Show the current time</i>

<b>🔹 Advanced Commands:</b>
/tokendetail [tokenaddress] - <i>Get token details</i>
/tokenbalances [walletaddress] - <i>View wallet token balances</i>
/walletpnl [walletaddress] - <i>Analyze wallet trading PnL</i>

<b>Example:</b>
/tokendetail 603c7f932ed1fc6575303d8fb018fdcbb0f39a95
    `, { parse_mode: 'HTML' });
    });

    // /echo
    bot.onText(/\/echo (.+)/, (msg: Message, match: RegExpExecArray | null) => {
        const chatId = msg.chat.id;
        const resp = match?.[1];
        bot.sendMessage(chatId, resp || 'Nothing to echo!');
    });

    // /time
    bot.onText(/\/time/, (msg: Message) => {
        const chatId = msg.chat.id;
        const now = new Date().toLocaleString();
        bot.sendMessage(chatId, `⏰ Current time: ${now}`);
    });

    // /walletpnl [walletaddress]
    bot.onText(/\/walletpnl(?:\s+(\S+))?/, async (msg: Message, match: RegExpExecArray | null) => {
        const chatId = msg.chat.id;
        console.log(`[LOG] Wallet PnL command requested by user ${msg.from?.id} (${msg.from?.username || 'unknown'})`);

        if (!match || !match[1]) {
            console.log(`[LOG] Invalid walletpnl command parameters`);
            bot.sendMessage(chatId, 'Please provide a valid wallet address.\nExample: /walletpnl 0x603c7f932ed1fc6575303d8fb018fdcbb0f39a95');
            return;
        }

        const walletAddress = match[1];
        console.log(`[LOG] Fetching PnL data for wallet address: ${walletAddress}`);

        bot.sendMessage(chatId, `🔍 Fetching comprehensive PnL analysis for wallet address: ${walletAddress}. Please wait...`);

        try {
            const response = await axios.get(`https://api.vybenetwork.xyz/account/pnl/${walletAddress}`, {
                headers: {
                    'X-API-KEY': process.env.API_TOKEN as string,
                },
            });

            if (response.status !== 200 || !response.data) {
                bot.sendMessage(chatId, '❌ Failed to fetch wallet PnL data. Please try again later.');
                return;
            }

            const pnlData = response.data;

            if (!pnlData || pnlData.error) {
                bot.sendMessage(chatId, `❌ Error: ${pnlData.error || 'Failed to fetch wallet PnL data'}`);
                return;
            }

            const summary = pnlData.summary;
            const tokenMetrics = pnlData.tokenMetrics;

            let message = `🔵 *Wallet PnL Analysis for:* \`${walletAddress}\`\n\n`;

            message += `*Summary:*\n`;
            message += `- *Win Rate:* ${summary.winRate ? (summary.winRate * 100).toFixed(2) + '%' : 'N/A'}\n`;
            message += `- *Realized PnL (USD):* $${summary.realizedPnlUsd.toFixed(2)}\n`;
            message += `- *Unrealized PnL (USD):* $${summary.unrealizedPnlUsd.toFixed(2)}\n`;
            message += `- *Unique Tokens Traded:* ${summary.uniqueTokensTraded}\n`;
            message += `- *Average Trade (USD):* $${summary.averageTradeUsd.toFixed(2)}\n`;
            message += `- *Total Trades:* ${summary.tradesCount}\n`;
            message += `- *Winning Trades:* ${summary.winningTradesCount}\n`;
            message += `- *Losing Trades:* ${summary.losingTradesCount}\n`;
            message += `- *Trades Volume (USD):* $${summary.tradesVolumeUsd.toFixed(2)}\n`;
            message += `- *Best Performing Token:* ${summary.bestPerformingToken || 'N/A'}\n`;
            message += `- *Worst Performing Token:* ${summary.worstPerformingToken || 'N/A'}\n\n`;

            if (summary.pnlTrendSevenDays.length > 0) {
                message += `*PnL Trend (Last 7 Days):*\n`;
                summary.pnlTrendSevenDays.forEach((trend: any, index: number) => {
                    message += `   Day ${index + 1}: $${trend.toFixed(2)}\n`;
                });
                message += `\n`;
            }

            if (tokenMetrics.length > 0) {
                message += `*Token Metrics:*\n`;
                tokenMetrics.forEach((token: any) => {
                    message += `🔹 *${token.name} (${token.symbol})*\n`;
                    message += `   - *Realized PnL (USD):* $${token.realizedPnlUsd.toFixed(2)}\n`;
                    message += `   - *Unrealized PnL (USD):* $${token.unrealizedPnlUsd.toFixed(2)}\n`;
                    message += `   - *Trades Count:* ${token.tradesCount}\n`;
                    message += `   - *Volume (USD):* $${token.volumeUsd.toFixed(2)}\n\n`;
                });
            }

            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Error in /walletpnl command:', error);
            bot.sendMessage(chatId, '❌ An error occurred while fetching the wallet PnL data. Please try again later.');
        }
    });

    // /tokenbalances [walletaddress]
    bot.onText(/\/tokenbalances(?:\s+(\S+))?/, async (msg: Message, match: RegExpExecArray | null) => {
        const chatId = msg.chat.id;
        console.log(`[LOG] tokenbalances command requested by user ${msg.from?.id} (${msg.from?.username || 'unknown'})`);

        if (!match || !match[1]) {
            console.log(`[LOG] Invalid tokenbalances command parameters`);
            bot.sendMessage(chatId, 'Please provide a valid wallet address. Example: /tokenbalances 0x603c7f932ed1fc6575303d8fb018fdcbb0f39a95');
            return;
        }

        const walletAddress = match[1];
        console.log(`[LOG] Fetching token balances for wallet address: ${walletAddress}`);

        bot.sendMessage(chatId, `🔍 Fetching token balances for wallet address: ${walletAddress}.\nPlease wait...`);

        try {
            const response = await axios.get(`https://api.vybenetwork.xyz/account/token-balance/${walletAddress}`, {
                headers: {
                    'X-API-KEY': process.env.API_TOKEN as string,
                },
            });

            if (response.status !== 200 || !response.data) {
                bot.sendMessage(chatId, '❌ Failed to fetch token balances. Please try again later.');
                return;
            }

            const balanceData = response.data;

            if (!balanceData || balanceData.error) {
                bot.sendMessage(chatId, `❌ Error: ${balanceData.error || 'Failed to fetch token balances'}`);
                return;
            }

            let message = `🔵 *Token Balances for Wallet:* \`${walletAddress}\`\n\n`;
            message += `*Total Token Value (USD):* $${balanceData.totalTokenValueUsd}\n`;
            message += `*1-Day Change:* ${balanceData.totalTokenValueUsd1dChange}%\n`;
            message += `*Total Tokens:* ${balanceData.totalTokenCount}\n\n`;

            balanceData.data.forEach((token: any) => {
                message += `🔹 *${token.name} (${token.symbol})*\n`;
                message += `   *Amount:* ${token.amount}\n`;
                message += `   *Value (USD):* $${token.valueUsd}\n`;
                message += `   *Price (USD):* $${token.priceUsd}\n`;
                message += `   *1-Day Price Change:* ${token.priceUsd1dChange}%\n`;
                message += `   *Category:* ${token.category}\n`;
                message += `   *Verified:* ${token.verified ? '✅ Yes' : '❌ No'}\n\n`;
            });

            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Error in /tokenbalances command:', error);
            bot.sendMessage(chatId, '❌ An error occurred while fetching the token balances. Please try again later.');
        }
    });

    // /tokendetail [tokenaddress]
    bot.onText(/\/tokendetail(?:\s+(\S+))?/, async (msg: Message, match: RegExpExecArray | null) => {
        const chatId = msg.chat.id;
        console.log(`[LOG] tokendetail command requested by user ${msg.from?.id} (${msg.from?.username || 'unknown'})`);

        if (!match || !match[1]) {
            console.log(`[LOG] Invalid tokendetail command parameters`);
            bot.sendMessage(chatId, 'Please provide a valid token address. Example: /tokendetail 0x603c7f932ed1fc6575303d8fb018fdcbb0f39a95');
            return;
        }

        const tokenAddress = match[1];
        console.log(`[LOG] Fetching token details for address: ${tokenAddress}`);

        bot.sendMessage(chatId, `🔍 Fetching details for token address: ${tokenAddress}.\nPlease wait...`);

        try {
            const response = await axios.get(`https://api.vybenetwork.xyz/token/${tokenAddress}`, {
                headers: {
                    'X-API-KEY': process.env.API_TOKEN as string,
                },
            });

            if (response.status !== 200 || !response.data) {
                bot.sendMessage(chatId, '❌ Failed to fetch token details. Please try again later.');
                return;
            }

            const tokenData = response.data;

            if (!tokenData || tokenData.error) {
                bot.sendMessage(chatId, `❌ Error: ${tokenData.error || 'Failed to fetch token details'}`);
                return;
            }

            const message = `🔵 *Token Details:*

*Name:* ${tokenData.name || 'N/A'}
*Symbol:* ${tokenData.symbol || 'N/A'}
*Decimals:* ${tokenData.decimal || 'N/A'}
*Current Supply:* ${tokenData.currentSupply ? tokenData.currentSupply.toLocaleString() : 'N/A'}
*Market Cap:* $${tokenData.marketCap ? tokenData.marketCap.toLocaleString() : 'N/A'}
*24h Volume:* $${tokenData.usdValueVolume24h ? tokenData.usdValueVolume24h.toLocaleString() : 'N/A'}
*Token Address:* \`${tokenAddress}\`

*Additional Info:*
- *Verified:* ${tokenData.verified ? '✅ Yes' : '❌ No'}
- *Last Updated:* ${tokenData.updateTime ? new Date(tokenData.updateTime * 1000).toLocaleString() : 'N/A'}`;

            if (tokenData.logoUrl) {
                await bot.sendPhoto(chatId, tokenData.logoUrl, {
                    caption: message,
                    parse_mode: 'Markdown',
                });
            } else {
                bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            }
        } catch (error) {
            console.error('Error in /tokendetail command:', error);
            bot.sendMessage(chatId, '❌ An error occurred while fetching the token details. Please try again later.');
        }
    });

    // Fallback for non-commands & text messages
    bot.on('message', (msg: Message) => {
        const chatId = msg.chat.id;

        // Check if the message starts with '/' and no command matched
        if (msg.text?.startsWith('/') && !msg.text.match(/^\/(start|help|echo|time|walletpnl|tokenbalances|tokendetail)/)) {
            bot.sendMessage(chatId, `⚠️ Unknown command: "${msg.text}". Type /help to see available commands.`);
        } else if (!msg.text?.startsWith('/')) {
            bot.sendMessage(chatId, `🤖 I received your message: "${msg.text}".\nSince I work only on configured commands, type /help to see available commands.`);
        }
    });

}

export default bot;