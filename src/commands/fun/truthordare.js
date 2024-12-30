const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('truthordare')
        .setDescription('Play Truth or Dare with another user!')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Who do you want to play with?')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('choice')
                .setDescription('Truth or Dare?')
                .setRequired(true)
                .addChoices(
                    { name: '🤔 Truth', value: 'truth' },
                    { name: '🎯 Dare', value: 'dare' }
                )),

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const choice = interaction.options.getString('choice');

        // Don't allow self-targeting or bot-targeting
        if (target.id === interaction.user.id) {
            return await interaction.reply({
                content: "You can't play with yourself! Choose another player.",
                ephemeral: true
            });
        }
        if (target.bot) {
            return await interaction.reply({
                content: "You can't play with a bot! Choose a real player.",
                ephemeral: true
            });
        }

        const questions = {
            truth: [
                "What's your most embarrassing gaming moment?",
                "Which Discord member would you want to be stranded on an island with?",
                "What's the weirdest dream you've ever had?",
                "What's your guilty pleasure song?",
                "What's the most childish thing you still do?",
                "What's your biggest pet peeve about Discord?",
                "What's the worst message you've ever sent by accident?",
                "What's your most used emoji and why?",
                "If you could swap lives with someone in this server for a day, who would it be?",
                "What's your most controversial gaming opinion?"
            ],
            dare: [
                "Change your Discord status to something embarrassing for 1 hour!",
                "Send a screenshot of your most recent DMs (keeping it appropriate)!",
                "Type everything backwards for the next 10 minutes!",
                "Send a voice message singing your favorite song!",
                "Use only emojis to communicate for the next 5 minutes!",
                "Send your most recent photo from your gallery (keeping it appropriate)!",
                "Write a haiku about another server member!",
                "Change your Discord avatar to match another server member for 30 minutes!",
                "Send a message in all caps expressing your love for vegetables!",
                "Create a meme about the person who challenged you!"
            ]
        };

        const selectedQuestion = questions[choice][Math.floor(Math.random() * questions[choice].length)];

        const embed = new EmbedBuilder()
            .setTitle('🎲 Truth or Dare! 🎲')
            .setColor(choice === 'truth' ? '#4169E1' : '#FF69B4')
            .addFields(
                { name: 'Challenge From', value: `${interaction.user}`, inline: true },
                { name: 'Challenge To', value: `${target}`, inline: true },
                { name: 'Type', value: choice === 'truth' ? '🤔 Truth' : '🎯 Dare', inline: true },
                { name: choice === 'truth' ? 'Question' : 'Challenge', value: selectedQuestion }
            )
            .setFooter({ text: 'You have 24 hours to respond!' })
            .setTimestamp();

        // Create accept/decline buttons
        const row = {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 3,
                    label: 'Accept Challenge',
                    custom_id: 'accept_challenge',
                    emoji: '✅'
                },
                {
                    type: 2,
                    style: 4,
                    label: 'Decline Challenge',
                    custom_id: 'decline_challenge',
                    emoji: '❌'
                }
            ]
        };

        await interaction.reply({
            content: `Hey ${target}! You've been challenged to Truth or Dare!`,
            embeds: [embed],
            components: [row]
        });

        // Create a collector for the buttons
        const filter = i => {
            return ['accept_challenge', 'decline_challenge'].includes(i.customId) && 
                   i.user.id === target.id;
        };

        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            time: 86400000 // 24 hours
        });

        collector.on('collect', async i => {
            if (i.customId === 'accept_challenge') {
                const acceptEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('Challenge Accepted! 🎉')
                    .setDescription(`${target} has accepted the challenge! Complete your ${choice} and reply in this thread!`)
                    .setTimestamp();

                await i.update({
                    embeds: [embed, acceptEmbed],
                    components: []
                });

                // Create a thread for the response
                await interaction.channel.threads.create({
                    name: `${interaction.user.username} vs ${target.username} - ${choice}`,
                    autoArchiveDuration: 1440,
                    reason: 'Truth or Dare challenge'
                });
            } else {
                const declineEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('Challenge Declined 😢')
                    .setDescription(`${target} has declined the challenge!`)
                    .setTimestamp();

                await i.update({
                    embeds: [embed, declineEmbed],
                    components: []
                });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({
                    content: `${target} didn't respond to the challenge in time!`,
                    components: []
                });
            }
        });
    }
}; 