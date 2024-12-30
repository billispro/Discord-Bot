const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Get the avatar of a user')
        .addUserOption(option => 
            option
                .setName('user')
                .setDescription('The user to get the avatar from (leave empty for your own avatar)')
                .setRequired(false))
        .addStringOption(option =>
            option
                .setName('format')
                .setDescription('The image format')
                .setRequired(false)
                .addChoices(
                    { name: 'png', value: 'png' },
                    { name: 'jpg', value: 'jpg' },
                    { name: 'webp', value: 'webp' },
                    { name: 'gif', value: 'gif' }
                ))
        .addIntegerOption(option =>
            option
                .setName('size')
                .setDescription('The size of the image')
                .setRequired(false)
                .addChoices(
                    { name: '16', value: 16 },
                    { name: '32', value: 32 },
                    { name: '64', value: 64 },
                    { name: '128', value: 128 },
                    { name: '256', value: 256 },
                    { name: '512', value: 512 },
                    { name: '1024', value: 1024 },
                    { name: '2048', value: 2048 },
                    { name: '4096', value: 4096 }
                )),

    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const format = interaction.options.getString('format') || 'png';
        const size = interaction.options.getInteger('size') || 1024;

        // Get avatar URL with specified format and size
        const avatarUrl = user.displayAvatarURL({
            format: format,
            size: size,
            dynamic: true // This will return GIF if the avatar is animated
        });

        // Get member for additional info (if user is in the server)
        const member = interaction.guild.members.cache.get(user.id);
        const color = member ? member.displayHexColor : '#000000';

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`${user.tag}'s Avatar`)
            .setDescription(`[Download Avatar](${avatarUrl})`)
            .setImage(avatarUrl)
            .addFields(
                { 
                    name: 'Format', 
                    value: format.toUpperCase(), 
                    inline: true 
                },
                { 
                    name: 'Size', 
                    value: `${size}x${size}`, 
                    inline: true 
                },
                {
                    name: 'Animated',
                    value: user.avatar?.startsWith('a_') ? 'Yes' : 'No',
                    inline: true
                }
            )
            .setFooter({ 
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            })
            .setTimestamp();

        // Create button row for different formats
        const row = {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 5, // Link button
                    label: 'PNG',
                    url: user.displayAvatarURL({ format: 'png', size: size }),
                },
                {
                    type: 2,
                    style: 5,
                    label: 'JPG',
                    url: user.displayAvatarURL({ format: 'jpg', size: size }),
                },
                {
                    type: 2,
                    style: 5,
                    label: 'WEBP',
                    url: user.displayAvatarURL({ format: 'webp', size: size }),
                }
            ]
        };

        // Add GIF button if avatar is animated
        if (user.avatar?.startsWith('a_')) {
            row.components.push({
                type: 2,
                style: 5,
                label: 'GIF',
                url: user.displayAvatarURL({ format: 'gif', size: size }),
            });
        }

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    }
}; 