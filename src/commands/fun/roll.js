const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll various types of dice or generate random numbers!')
        .addSubcommand(subcommand =>
            subcommand
                .setName('dice')
                .setDescription('Roll one or more dice')
                .addIntegerOption(option =>
                    option.setName('sides')
                        .setDescription('Number of sides on the dice (default: 6)')
                        .setMinValue(2)
                        .setMaxValue(100))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Number of dice to roll (default: 1)')
                        .setMinValue(1)
                        .setMaxValue(25)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('number')
                .setDescription('Generate a random number between min and max')
                .addIntegerOption(option =>
                    option.setName('min')
                        .setDescription('Minimum number')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('max')
                        .setDescription('Maximum number')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('custom')
                .setDescription('Roll from a custom list of options')
                .addStringOption(option =>
                    option.setName('options')
                        .setDescription('List of options separated by commas')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'dice':
                await handleDiceRoll(interaction);
                break;
            case 'number':
                await handleNumberRoll(interaction);
                break;
            case 'custom':
                await handleCustomRoll(interaction);
                break;
        }
    }
};

async function handleDiceRoll(interaction) {
    const sides = interaction.options.getInteger('sides') || 6;
    const amount = interaction.options.getInteger('amount') || 1;

    const rolls = [];
    let total = 0;

    for (let i = 0; i < amount; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll);
        total += roll;
    }

    const diceEmoji = getDiceEmoji(sides);
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`🎲 Dice Roll Results`)
        .addFields(
            { name: 'Dice Type', value: `${diceEmoji} d${sides}`, inline: true },
            { name: 'Number of Dice', value: `${amount}`, inline: true },
            { name: 'Total', value: `${total}`, inline: true },
            { name: 'Individual Rolls', value: rolls.join(', ') }
        )
        .setFooter({ text: `Rolled by ${interaction.user.tag}` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleNumberRoll(interaction) {
    const min = interaction.options.getInteger('min');
    const max = interaction.options.getInteger('max');

    if (min >= max) {
        return await interaction.reply({
            content: '❌ Minimum number must be less than maximum number!',
            ephemeral: true
        });
    }

    const result = Math.floor(Math.random() * (max - min + 1)) + min;

    const embed = new EmbedBuilder()
        .setColor('#4169E1')
        .setTitle('🎯 Random Number Generator')
        .addFields(
            { name: 'Range', value: `${min} - ${max}`, inline: true },
            { name: 'Result', value: `**${result}**`, inline: true }
        )
        .setFooter({ text: `Generated by ${interaction.user.tag}` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleCustomRoll(interaction) {
    const options = interaction.options.getString('options')
        .split(',')
        .map(option => option.trim())
        .filter(option => option.length > 0);

    if (options.length < 2) {
        return await interaction.reply({
            content: '❌ Please provide at least 2 options separated by commas!',
            ephemeral: true
        });
    }

    const result = options[Math.floor(Math.random() * options.length)];

    const embed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle('🎪 Custom Roll Result')
        .addFields(
            { name: 'Options', value: options.join('\n'), inline: false },
            { name: 'Result', value: `**${result}**`, inline: false }
        )
        .setFooter({ text: `Rolled by ${interaction.user.tag}` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

function getDiceEmoji(sides) {
    const diceEmojis = {
        4: '🎲',   // d4
        6: '🎲',   // d6
        8: '🎲',   // d8
        10: '🎲',  // d10
        12: '🎲',  // d12
        20: '🎲',  // d20
        100: '💯'  // d100
    };
    return diceEmojis[sides] || '🎲';
} 