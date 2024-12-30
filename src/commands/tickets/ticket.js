const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ChannelType
} = require('discord.js');
const ticketService = require('../../services/ticketService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Ticket system management')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Setup the ticket system')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel where the ticket panel will be displayed')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText))
                .addRoleOption(option =>
                    option.setName('support_role')
                        .setDescription('Role for support team members')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('category')
                        .setDescription('Category where tickets will be created')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Create a new ticket panel')
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Panel title')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Panel description')
                        .setRequired(true))),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            // Check if system is configured before allowing panel creation
            if (subcommand === 'panel') {
                const config = await ticketService.getConfig(interaction.guild.id);
                if (!config) {
                    return await interaction.reply({
                        content: '❌ The ticket system has not been set up yet! Please use `/ticket setup` first.',
                        ephemeral: true
                    });
                }
            }

            switch (subcommand) {
                case 'setup':
                    await this.setupTicketSystem(interaction);
                    break;
                case 'panel':
                    await this.createTicketPanel(interaction);
                    break;
            }
        } catch (error) {
            console.error('Error executing ticket command:', error);
            await interaction.reply({
                content: 'An error occurred while executing the command. Please try again.',
                ephemeral: true
            });
        }
    },

    async setupTicketSystem(interaction) {
        const channel = interaction.options.getChannel('channel');
        const supportRole = interaction.options.getRole('support_role');
        const category = interaction.options.getChannel('category');

        try {
            // Validate permissions
            const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
            
            // Check channel permissions
            if (!channel.permissionsFor(botMember).has(['SendMessages', 'ViewChannel', 'EmbedLinks'])) {
                return await interaction.reply({
                    content: '❌ I need permissions to send messages, view the channel, and embed links in the specified channel!',
                    ephemeral: true
                });
            }

            // Check category permissions
            if (!category.permissionsFor(botMember).has(['ManageChannels', 'ViewChannel'])) {
                return await interaction.reply({
                    content: '❌ I need permissions to manage channels and view the category!',
                    ephemeral: true
                });
            }

            await ticketService.setupSystem({
                guildId: interaction.guild.id,
                channelId: channel.id,
                supportRoleId: supportRole.id,
                categoryId: category.id
            });

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Ticket System Setup Complete')
                .addFields(
                    { name: 'Panel Channel', value: `${channel}`, inline: true },
                    { name: 'Support Role', value: `${supportRole}`, inline: true },
                    { name: 'Tickets Category', value: `${category}`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error setting up ticket system:', error);
            await interaction.reply({
                content: '❌ An error occurred while setting up the ticket system.',
                ephemeral: true
            });
        }
    },

    async createTicketPanel(interaction) {
        try {
            const config = await ticketService.getConfig(interaction.guild.id);
            const channel = interaction.guild.channels.cache.get(config.channelId);

            if (!channel) {
                return await interaction.reply({
                    content: '❌ The configured ticket channel no longer exists! Please run `/ticket setup` again.',
                    ephemeral: true
                });
            }

            const title = interaction.options.getString('title');
            const description = interaction.options.getString('description');

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(title)
                .setDescription(description)
                .setFooter({ text: 'Click the button below to create a ticket' });

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_ticket')
                        .setLabel('Create Ticket')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🎫'),
                    new ButtonBuilder()
                        .setCustomId('view_tickets')
                        .setLabel('My Tickets')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📋')
                );

            await channel.send({
                embeds: [embed],
                components: [buttons]
            });

            await interaction.reply({
                content: '✅ Ticket panel created successfully!',
                ephemeral: true
            });
        } catch (error) {
            console.error('Error creating ticket panel:', error);
            await interaction.reply({
                content: '❌ An error occurred while creating the ticket panel. Make sure the system is properly configured.',
                ephemeral: true
            });
        }
    }
}; 