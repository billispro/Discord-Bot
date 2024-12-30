const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Play Rock, Paper, Scissors with special items!')
        .addStringOption(option =>
            option.setName('choice')
                .setDescription('Choose your weapon!')
                .setRequired(true)
                .addChoices(
                    { name: '🪨 Rock', value: 'rock' },
                    { name: '📄 Paper', value: 'paper' },
                    { name: '✂️ Scissors', value: 'scissors' },
                    { name: '🔥 Fire', value: 'fire' },
                    { name: '💧 Water', value: 'water' },
                    { name: '🌪️ Wind', value: 'wind' }
                )),

    async execute(interaction) {
        const userChoice = interaction.options.getString('choice');
        const choices = ['rock', 'paper', 'scissors', 'fire', 'water', 'wind'];
        const botChoice = choices[Math.floor(Math.random() * choices.length)];

        const emojis = {
            rock: '🪨',
            paper: '📄',
            scissors: '✂️',
            fire: '🔥',
            water: '💧',
            wind: '🌪️'
        };

        // Complex winning conditions
        const winConditions = {
            rock: ['scissors', 'fire', 'wind'],
            paper: ['rock', 'water', 'wind'],
            scissors: ['paper', 'fire', 'wind'],
            fire: ['paper', 'wind', 'scissors'],
            water: ['fire', 'rock', 'scissors'],
            wind: ['water', 'paper', 'rock']
        };

        // Determine winner
        let result;
        if (userChoice === botChoice) {
            result = "It's a tie! 🤝";
        } else if (winConditions[userChoice].includes(botChoice)) {
            result = "You win! 🎉";
        } else {
            result = "You lose! 😢";
        }

        // Get explanation
        const explanation = getExplanation(userChoice, botChoice);

        const embed = new EmbedBuilder()
            .setTitle('🎮 Rock, Paper, Scissors, Fire, Water, Wind!')
            .setColor(getResultColor(result))
            .addFields(
                { name: 'Your Choice', value: `${emojis[userChoice]} ${capitalizeFirst(userChoice)}`, inline: true },
                { name: 'Bot Choice', value: `${emojis[botChoice]} ${capitalizeFirst(botChoice)}`, inline: true },
                { name: 'Result', value: result, inline: true },
                { name: 'Explanation', value: explanation }
            )
            .setFooter({ text: 'Try again with a different choice!' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

function getResultColor(result) {
    switch (result) {
        case "You win! 🎉":
            return '#00ff00';
        case "You lose! 😢":
            return '#ff0000';
        default:
            return '#ffff00';
    }
}

function capitalizeFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function getExplanation(userChoice, botChoice) {
    const explanations = {
        rock: {
            scissors: '🪨 Rock crushes ✂️ Scissors!',
            fire: '🪨 Rock smothers 🔥 Fire!',
            wind: '🪨 Rock blocks 🌪️ Wind!',
            paper: '📄 Paper wraps 🪨 Rock!',
            water: '💧 Water erodes 🪨 Rock!'
        },
        paper: {
            rock: '📄 Paper wraps 🪨 Rock!',
            water: '📄 Paper absorbs 💧 Water!',
            wind: '📄 Paper rides 🌪️ Wind!',
            scissors: '✂️ Scissors cuts 📄 Paper!',
            fire: '🔥 Fire burns 📄 Paper!'
        },
        scissors: {
            paper: '✂️ Scissors cuts 📄 Paper!',
            fire: '✂️ Scissors melts in 🔥 Fire!',
            wind: '✂️ Scissors slices through 🌪️ Wind!',
            rock: '🪨 Rock crushes ✂️ Scissors!',
            water: '💧 Water rusts ✂️ Scissors!'
        },
        fire: {
            paper: '🔥 Fire burns 📄 Paper!',
            wind: '🔥 Fire consumes 🌪️ Wind!',
            scissors: '🔥 Fire melts ✂️ Scissors!',
            water: '💧 Water extinguishes 🔥 Fire!',
            rock: '🪨 Rock smothers 🔥 Fire!'
        },
        water: {
            fire: '💧 Water extinguishes 🔥 Fire!',
            rock: '💧 Water erodes 🪨 Rock!',
            scissors: '💧 Water rusts ✂️ Scissors!',
            wind: '🌪️ Wind disperses 💧 Water!',
            paper: '📄 Paper absorbs 💧 Water!'
        },
        wind: {
            water: '🌪️ Wind disperses 💧 Water!',
            paper: '🌪️ Wind tears 📄 Paper!',
            rock: '🌪️ Wind is blocked by 🪨 Rock!',
            fire: '🔥 Fire consumes 🌪️ Wind!',
            scissors: '✂️ Scissors cuts through 🌪️ Wind!'
        }
    };

    return explanations[userChoice][botChoice] || 'It\'s a tie!';
} 