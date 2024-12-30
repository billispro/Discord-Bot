const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ethereum')
        .setDescription('Get real-time Ethereum information')
        .addStringOption(option =>
            option.setName('currency')
                .setDescription('Select currency for price (default: USD)')
                .setRequired(false)
                .addChoices(
                    { name: '🇺🇸 USD', value: 'usd' },
                    { name: '🇪🇺 EUR', value: 'eur' },
                    { name: '🇬🇧 GBP', value: 'gbp' },
                    { name: '🇯🇵 JPY', value: 'jpy' },
                    { name: '🇨🇭 CHF', value: 'chf' }
                )),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const currency = interaction.options.getString('currency') || 'usd';
            const { data } = await axios.get('https://api.coingecko.com/api/v3/coins/ethereum?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false&sparkline=true');

            const currencySymbols = {
                usd: '$',
                eur: '€',
                gbp: '£',
                jpy: '¥',
                chf: 'CHF'
            };

            const formatNumber = (num) => {
                return new Intl.NumberFormat('en-US').format(num);
            };

            const formatCurrency = (num, curr) => {
                return `${currencySymbols[curr]}${formatNumber(num)}`;
            };

            const priceChange24h = data.market_data.price_change_percentage_24h;
            const priceChangeColor = priceChange24h >= 0 ? '#00ff00' : '#ff0000';
            const priceChangeEmoji = priceChange24h >= 0 ? '📈' : '📉';

            const embed = new EmbedBuilder()
                .setColor(priceChangeColor)
                .setTitle(`Ethereum (ETH) Information ${priceChangeEmoji}`)
                .setThumbnail(data.image.large)
                .addFields(
                    {
                        name: '💰 Current Price',
                        value: formatCurrency(data.market_data.current_price[currency], currency),
                        inline: true
                    },
                    {
                        name: '📊 24h Change',
                        value: `${priceChange24h.toFixed(2)}%`,
                        inline: true
                    },
                    {
                        name: '💎 Market Cap',
                        value: formatCurrency(data.market_data.market_cap[currency], currency),
                        inline: true
                    },
                    {
                        name: '📈 24h High',
                        value: formatCurrency(data.market_data.high_24h[currency], currency),
                        inline: true
                    },
                    {
                        name: '📉 24h Low',
                        value: formatCurrency(data.market_data.low_24h[currency], currency),
                        inline: true
                    },
                    {
                        name: '🔄 24h Volume',
                        value: formatCurrency(data.market_data.total_volume[currency], currency),
                        inline: true
                    },
                    {
                        name: '📊 All Time High',
                        value: `${formatCurrency(data.market_data.ath[currency], currency)}\n(${new Date(data.market_data.ath_date[currency]).toLocaleDateString()})`,
                        inline: true
                    },
                    {
                        name: '💫 Circulating Supply',
                        value: `${formatNumber(data.market_data.circulating_supply)} ETH`,
                        inline: true
                    },
                    {
                        name: '🌐 Total Supply',
                        value: `${formatNumber(data.market_data.total_supply)} ETH`,
                        inline: true
                    }
                )
                .addFields(
                    {
                        name: '📈 Price Changes',
                        value: `1h: ${data.market_data.price_change_percentage_1h_in_currency[currency].toFixed(2)}%\n` +
                               `24h: ${data.market_data.price_change_percentage_24h_in_currency[currency].toFixed(2)}%\n` +
                               `7d: ${data.market_data.price_change_percentage_7d_in_currency[currency].toFixed(2)}%\n` +
                               `30d: ${data.market_data.price_change_percentage_30d_in_currency[currency].toFixed(2)}%`,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Last Updated: ${new Date(data.market_data.last_updated).toLocaleString()} | Data from CoinGecko`
                })
                .setTimestamp();

            if (data.sentiment_votes_up_percentage) {
                embed.addFields({
                    name: '📊 Market Sentiment',
                    value: `👍 ${data.sentiment_votes_up_percentage.toFixed(1)}% Positive\n` +
                           `👎 ${(100 - data.sentiment_votes_up_percentage).toFixed(1)}% Negative`,
                    inline: false
                });
            }

            await interaction.editReply({
                embeds: [embed],
                components: [{
                    type: 1,
                    components: [{
                        type: 2,
                        style: 5,
                        label: 'More Details on CoinGecko',
                        url: `https://www.coingecko.com/en/coins/ethereum`,
                        emoji: '🔗'
                    }]
                }]
            });

        } catch (error) {
            console.error('Error fetching Ethereum data:', error);
            await interaction.editReply({
                content: '❌ Error fetching Ethereum data. Please try again later.',
                ephemeral: true
            });
        }
    }
}; 