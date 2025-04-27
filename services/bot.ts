import TelegramBot, { Message } from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import { generatePieChart } from '../utils/pieChart';
import { generateLineChart } from '../utils/lineChart';
import { analyzeTokenPriceVolume } from './geminiService';
import { sendLargeMessage } from '../utils/sendLargeMessage';

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN as string, { polling: false });

export function registerCommands() {

    bot.onText(/\/start/, (msg: Message) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, `👋 Hello ${msg.from?.first_name || 'there'}! Welcome to the Vybe Telegram Bot 🤖.\n\nType /help to see available commands.`);
    });

    /* /echo [text] - <i>Repeat your text</i>
/time - <i>Show the current time</i> */

    // /help
    bot.onText(/\/help/, (msg: Message) => {
        const chatId = msg.chat.id;
        console.log(`[LOG] Help command requested by user ${msg.from?.id} (${msg.from?.username || 'unknown'})`);
        console.log(`[LOG] Chat ID: ${chatId}`);
        bot.sendMessage(chatId, `📋 *Command Manual:*

**🔹 Basic Commands:**

_Start interacting with the bot -_
\`/start\`

_View all available commands -_ 
\`/help\`


**🔹 Advanced Commands:**

_Get token details -_
\`/tokendetail <token_address>\`

_View wallet token balances -_
\`/tokenbalances <wallet_address>\`

_Analyze wallet trading PnL -_
\`/walletpnl <wallet_address>\`

_Get top holders of a token -_
\`/topholders <token_address>\`

_Get 2-week price chart -_
\`/get2wpricechart <token_address>\`

👉 Click on the command to copy, replace the placeholder, and send it!

**For example:**
\`/tokendetail y1k9ZRqLwKLbyUe5LfQf53jYXeSyvrFi7URt4FWpump\`
        `, { parse_mode: 'Markdown' });

});


    // // /echo
    // bot.onText(/\/echo (.+)/, (msg: Message, match: RegExpExecArray | null) => {
    //     const chatId = msg.chat.id;
    //     const resp = match?.[1];
    //     bot.sendMessage(chatId, resp || 'Nothing to echo!');
    // });

    // // /time
    // bot.onText(/\/time/, (msg: Message) => {
    //     const chatId = msg.chat.id;
    //     const now = new Date().toLocaleString();
    //     bot.sendMessage(chatId, `⏰ Current time: ${now}`);
    // });

    // /walletpnl <wallet address>
    bot.onText(/\/walletpnl(?:\s+(\S+))?/, async (msg: Message, match: RegExpExecArray | null) => {
        const chatId = msg.chat.id;
        console.log(`[LOG] Wallet PnL command requested by user ${msg.from?.id} (${msg.from?.username || 'unknown'})`);

        if (!match || !match[1]) {
            console.log(`[LOG] Invalid walletpnl command parameters`);
            bot.sendMessage(chatId, 'Please provide a valid wallet address.\nExample: `/walletpnl EBwMpd2zHKJuG3qxqBgLgNYpjS9DJLtPpG2CytcJqhJL`',{parse_mode: 'Markdown'});
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

             // Send additional message with network graph link
             const networkGraphLink = `https://widget.vybenetwork.com/network-graph?address=${walletAddress}&entity=wallet&connectionNode=wallet`;
             bot.sendMessage(chatId, `🌐 For an interactive visualization, visit its network graph provided by Vybe: [Click Here](${networkGraphLink})`, {
                 parse_mode: 'Markdown',
             });

        } catch (error) {
            console.error('Error in /walletpnl command:', error);
            bot.sendMessage(chatId, '❌ An error occurred while fetching the wallet PnL data. Please try again later.');
        }
    });

    // /tokenbalances <wallet address>
    bot.onText(/\/tokenbalances(?:\s+(\S+))?/, async (msg: Message, match: RegExpExecArray | null) => {
        const chatId = msg.chat.id;
        console.log(`[LOG] tokenbalances command requested by user ${msg.from?.id} (${msg.from?.username || 'unknown'})`);

        if (!match || !match[1]) {
            console.log(`[LOG] Invalid tokenbalances command parameters`);
            bot.sendMessage(chatId, 'Please provide a valid wallet address.\nExample: `/tokenbalances EBwMpd2zHKJuG3qxqBgLgNYpjS9DJLtPpG2CytcJqhJL`',{parse_mode: 'Markdown'});
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

            balanceData.data.sort((a: any, b: any) => Number(b.valueUsd) - Number(a.valueUsd));


            const maxTokensToShow = 20;
            const totalTokens = balanceData.data.length;
            const tokensToShow = balanceData.data.slice(0, maxTokensToShow);

            let message = `🔵 *Token Balances for Wallet:* \`${walletAddress}\`\n\n`;
            message += `*Total Token Value (USD):* $${balanceData.totalTokenValueUsd}\n`;
            message += `*1-Day Change:* ${balanceData.totalTokenValueUsd1dChange}%\n`;
            message += `*Total Tokens:* ${balanceData.totalTokenCount}\n\n`;

            tokensToShow.forEach((token: any) => {
                message += `🔹 *${token.name} (${token.symbol})*\n`;
                message += `   *% of Total Holdings:* ${(token.valueUsd / balanceData.totalTokenValueUsd * 100).toFixed(2)}%\n`;
                message += `   *Amount:* ${token.amount}\n`;
                message += `   *Value (USD):* $${token.valueUsd}\n`;
                message += `   *Price (USD):* $${token.priceUsd}\n`;
                message += `   *1-Day Price Change:* ${token.priceUsd1dChange}%\n`;
                message += `   *Category:* ${token.category}\n`;
                message += `   *Verified:* ${token.verified ? '✅ Yes' : '❌ No'}\n\n`;
            });

            if (totalTokens > maxTokensToShow) {
                const remaining = totalTokens - maxTokensToShow;
                message += `➕ *And ${remaining} more tokens...*\n\n`;
            }

            // 🔥 Send smartly in chunks
            await sendLargeMessage(bot, chatId, message, { parse_mode: 'Markdown' });

            // Generate and send pie chart
            const pieChartPath = await generatePieChart(tokensToShow);
            await bot.sendPhoto(chatId, pieChartPath, { caption: '📊 Token Distribution' });

            // Optional: clean up after sending
            fs.unlinkSync(pieChartPath);

        } catch (error) {
            console.error('Error in /tokenbalances command:', error);
            bot.sendMessage(chatId, '❌ An error occurred while fetching the token balances. Please try again later.');
        }
    });

    // /tokendetail <token address>
    bot.onText(/\/tokendetail(?:\s+(\S+))?/, async (msg: Message, match: RegExpExecArray | null) => {
        const chatId = msg.chat.id;
        console.log(`[LOG] tokendetail command requested by user ${msg.from?.id} (${msg.from?.username || 'unknown'})`);

        if (!match || !match[1]) {
            console.log(`[LOG] Invalid tokendetail command parameters`);
            bot.sendMessage(chatId, 'Please provide a valid token address.\nExample: `/tokendetail y1k9ZRqLwKLbyUe5LfQf53jYXeSyvrFi7URt4FWpump`',{parse_mode: 'Markdown'});
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
*Price:* ${tokenData.price ? '$' + tokenData.price.toFixed(12) : 'N/A'} 
*Current Supply:* ${formatValue(tokenData.currentSupply)}
*Market Cap:* $${formatValue(tokenData.marketCap)}
*24h Volume Transfer:* $${formatValue(tokenData.usdValueVolume24h)}
*Price1d ago:* ${tokenData.price1d ? '$' + tokenData.price1d.toFixed(12) : 'N/A'}
*Price7d ago:* ${tokenData.price7d ? '$' + tokenData.price7d.toFixed(12) : 'N/A'}
*category:* ${tokenData.category || 'N/A'}
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

            // Send additional message with network graph link
            const networkGraphLink = `https://widget.vybenetwork.com/network-graph?address=${tokenAddress}&entity=token&connectionNode=wallet`;
            bot.sendMessage(chatId, `🌐 For an interactive visualization, visit its network graph provided by Vybe: [Click Here](${networkGraphLink})`, {
                parse_mode: 'Markdown',
            });
            
        } catch (error) {
            console.error('Error in /tokendetail command:', error);
            bot.sendMessage(chatId, '❌ An error occurred while fetching the token details. Please try again later.');
        }
    });

    // /topholders <token address>
    bot.onText(/\/topholders(?:\s+(\S+))?/, async (msg: Message, match: RegExpExecArray | null) => {
        const chatId = msg.chat.id;
        console.log(`[LOG] topholders command requested by user ${msg.from?.id} (${msg.from?.username || 'unknown'})`);

        if (!match || !match[1]) {
            console.log(`[LOG] Invalid topholders command parameters`);
            bot.sendMessage(chatId, 'Please provide a valid token address.\nExample: `/topholders y1k9ZRqLwKLbyUe5LfQf53jYXeSyvrFi7URt4FWpump`',{parse_mode: 'Markdown'});
            return;
        }

        const tokenAddress = match[1];
        console.log(`[LOG] Fetching top holders for token address: ${tokenAddress}`);

        bot.sendMessage(chatId, `🔍 Fetching top holders for token address: ${tokenAddress}. Please wait...`);

        try {
            const response = await axios.get(`https://api.vybenetwork.xyz/token/${tokenAddress}/top-holders`, {
                headers: {
                    'X-API-KEY': process.env.API_TOKEN as string,
                },
            });

            if (response.status !== 200 || !response.data) {
                bot.sendMessage(chatId, '❌ Failed to fetch top holders. Please try again later.');
                return;
            }

            const holdersData = response.data.data;

            if (!holdersData || holdersData.length === 0) {
                bot.sendMessage(chatId, `❌ No top holders data found for token address: ${tokenAddress}`);
                return;
            }

            const topHolders = holdersData.slice(0, 10);

            let message = `🔵 *Top 10 Holders for Token:* \`${tokenAddress}\`\n\n`;

            topHolders.forEach((holder: any) => {
                message += `🔹 *Rank ${holder.rank}:*\n`;
                message += `   - *Address:* \`${holder.ownerAddress}\`\n`;
                message += `   - *Name:* ${holder.ownerName || 'N/A'}\n`;
                message += `   - *Balance:* ${formatValue(holder.balance)}\n`;
                message += `   - *Value (USD):* $${formatValue(holder.valueUsd)}\n`;
                message += `   - *% of Total Supply Held:* ${holder.percentageOfSupplyHeld.toFixed(2)}%\n\n`;
            });

            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Error in /topholders command:', error);
            bot.sendMessage(chatId, '❌ An error occurred while fetching the top holders. Please try again later.');
        }
    });

    // /get2wpricechart <token address>
    bot.onText(/\/get2wpricechart(?:\s+(\S+))?/, async (msg: Message, match: RegExpExecArray | null) => {
        const chatId = msg.chat.id;
        console.log(`[LOG] Price chart command requested by user ${msg.from?.id} (${msg.from?.username || 'unknown'})`);
        
        if (!match || !match[1]) {
            console.log(`[LOG] Invalid get2wpricechart command parameters`);
            bot.sendMessage(chatId, 'Please provide a valid token address.\nExample: `/get2wpricechart y1k9ZRqLwKLbyUe5LfQf53jYXeSyvrFi7URt4FWpump`',{parse_mode: 'Markdown'});
            return;
        }

        const tokenAddress = match[1];
        console.log(`[LOG] Fetching price data for token address: ${tokenAddress}`);

        bot.sendMessage(chatId, `🔍 Generating 7-day price chart for token: ${tokenAddress}. Please wait...`);

        try {
            const response = await axios.get(`https://api.vybenetwork.xyz/price/${tokenAddress}/token-ohlcv`, {
                headers: {
                    'X-API-KEY': process.env.API_TOKEN as string,
                },
                params: {
                    resolution: '1d'
                }
            });

            if (response.status !== 200 || !response.data || !response.data.data) {
                bot.sendMessage(chatId, '❌ Failed to fetch token price data. Please try again later.');
                return;
            }

            const data = response.data.data;
            const labels = data.map((item: any) => new Date(item.time * 1000).toLocaleDateString());
            const prices = data.map((item: any) => parseFloat(item.close));
            const volumes = data.map((item: any) => parseFloat(item.volumeUsd));

            // Calculate price change percentage
            const firstPrice = prices[0];
            const lastPrice = prices[prices.length - 1];
            const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
            const priceChangeEmoji = priceChange >= 0 ? '📈' : '📉';

            // Calculate volume change percentage
            const firstVolume = volumes[0];
            const lastVolume = volumes[volumes.length - 1];
            const volumeChange = ((lastVolume - firstVolume) / firstVolume) * 100;
            const volumeChangeEmoji = volumeChange >= 0 ? '📈' : '📉';

            const chartBuffer = await generateLineChart(
                labels,
                prices,
                volumes,
                `2-Week Price & Volume Chart for ${tokenAddress.slice(0, 8)}...`
            );

            await bot.sendPhoto(chatId, chartBuffer);

            // Prepare price/volume history for Gemini
            const priceVolumeHistory = data.map((item: any) => ({
                time: item.time,
                close: parseFloat(item.close),
                volumeUsd: parseFloat(item.volumeUsd)
            }));
            // Call Gemini for verdict
            let aiVerdict: string;
            try {
                aiVerdict = await analyzeTokenPriceVolume(tokenAddress, priceVolumeHistory);
            } catch (err) {
                aiVerdict = 'Could not get Gemini verdict due to an error.';
            }
            // Show more decimals if both changes are very small
            let priceChangeStr = priceChange.toFixed(2);
            let volumeChangeStr = volumeChange.toFixed(2);
            if (Math.abs(priceChange) < 0.01 && Math.abs(volumeChange) < 0.01) {
                priceChangeStr = priceChange.toFixed(8);
                volumeChangeStr = volumeChange.toFixed(8);
            }
            const verdict = `${priceChangeEmoji} Price Change (2w): ${priceChangeStr}%\n${volumeChangeEmoji} Volume Change (2w): ${volumeChangeStr}%\n\nGemini AI Verdict:\n${aiVerdict}`;
            bot.sendMessage(chatId, verdict);

        } catch (error) {
            console.error('Error generating price chart:', error);
            bot.sendMessage(chatId, '❌ Error generating price chart. Please try again later.');
        }
    });

    // Fallback for non-commands & text messages
    bot.on('message', (msg: Message) => {
        const chatId = msg.chat.id;

        // Check if the message starts with '/' and no command matched
        if (msg.text?.startsWith('/') && !msg.text.match(/^\/(start|help|echo|time|walletpnl|tokenbalances|tokendetail|topholders|get2wpricechart)/)) {
            bot.sendMessage(chatId, `⚠️ Unknown command: "${msg.text}". Type /help to see available commands.`);
        } else if (!msg.text?.startsWith('/')) {
            bot.sendMessage(chatId, `🤖 I received your message: "${msg.text}".\nSince I work only on configured commands, type /help to see available commands.`);
        }
    });
}

const formatValue = (value: number | undefined): string => {
    if (value === undefined || value === null) return 'N/A';
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
    return `${Number(value).toFixed(2)}`;
};



export default bot;