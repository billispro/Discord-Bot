const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder,
    ChannelType
} = require('discord.js');
const ticketService = require('../../services/ticketService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Manage ticket system settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current ticket settings'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('logs')
                .setDescription('Set ticket logs channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel for ticket logs')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('messages')
                .setDescription('Configure ticket messages')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Message type to configure')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Welcome Message', value: 'welcome' },
                            { name: 'Close Message', value: 'close' }
                        ))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The message content')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('limits')
                .setDescription('Configure ticket limits')
                .addIntegerOption(option =>
                    option.setName('max_tickets')
                        .setDescription('Maximum open tickets per user')
                        .setMinValue(1)
                        .setMaxValue(10))
                .addIntegerOption(option =>
                    option.setName('cooldown')
                        .setDescription('Cooldown between tickets (minutes)')
                        .setMinValue(1)
                        .setMaxValue(60)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('autoclose')
                .setDescription('Configure auto-close settings')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable/disable auto-close')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Days of inactivity before auto-close')
                        .setMinValue(1)
                        .setMaxValue(30))),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const config = await ticketService.getConfig(interaction.guild.id);

            if (!config) {
                return await interaction.reply({
                    content: '❌ Ticket system is not set up! Use `/ticket setup` first.',
                    ephemeral: true
                });
            }

            switch (subcommand) {
                case 'view':
                    await this.viewSettings(interaction, config);
                    break;
                case 'logs':
                    await this.setLogsChannel(interaction, config);
                    break;
                case 'messages':
                    await this.setMessages(interaction, config);
                    break;
                case 'limits':
                    await this.setLimits(interaction, config);
                    break;
                case 'autoclose':
                    await this.setAutoClose(interaction, config);
                    break;
            }
        } catch (error) {
            console.error('Error in settings command:', error);
            await interaction.reply({
                content: '❌ An error occurred while updating settings.',
                ephemeral: true
            });
        }
    },

    async viewSettings(interaction, config) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🛠️ Ticket System Settings')
            .addFields(
                { 
                    name: 'Channels',
                    value: `Panel: <#${config.channelId}>\nCategory: <#${config.categoryId}>\nLogs: ${config.settings.logsChannelId ? `<#${config.settings.logsChannelId}>` : 'Not set'}`,
                    inline: false
                },
                {
                    name: 'Limits',
                    value: `Max Tickets: ${config.settings.maxOpenTickets}\nCooldown: ${config.settings.ticketCooldown} minutes`,
                    inline: true
                },
                {
                    name: 'Auto-Close',
                    value: `Enabled: ${config.settings.autoClose.enabled ? 'Yes' : 'No'}\nInactivity: ${config.settings.autoClose.inactivityDays} days`,
                    inline: true
                },
                {
                    name: 'Support Role',
                    value: `<@&${config.supportRoleId}>`,
                    inline: true
                }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async setLimits(interaction, config) {
        const maxTickets = interaction.options.getInteger('max_tickets');
        const cooldown = interaction.options.getInteger('cooldown');

        const updates = {};
        if (maxTickets) updates['settings.maxOpenTickets'] = maxTickets;
        if (cooldown) updates['settings.ticketCooldown'] = cooldown;

        await ticketService.updateConfig(interaction.guild.id, updates);

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Ticket Limits Updated')
            .setDescription('The following settings have been updated:')
            .addFields(
                maxTickets ? { name: 'Max Tickets', value: `${maxTickets}`, inline: true } : null,
                cooldown ? { name: 'Cooldown', value: `${cooldown} minutes`, inline: true } : null
            )
            .filter(field => field !== null);

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async setAutoClose(interaction, config) {
        const enabled = interaction.options.getBoolean('enabled');
        const days = interaction.options.getInteger('days');

        const updates = {
            'settings.autoClose.enabled': enabled
        };

        if (days) {
            updates['settings.autoClose.inactivityDays'] = days;
        }

        await ticketService.updateConfig(interaction.guild.id, updates);

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Auto-Close Settings Updated')
            .addFields(
                { 
                    name: 'Auto-Close', 
                    value: enabled ? 'Enabled' : 'Disabled', 
                    inline: true 
                },
                days ? { 
                    name: 'Inactivity Days', 
                    value: `${days} days`, 
                    inline: true 
                } : null
            )
            .filter(field => field !== null);

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async setLogsChannel(interaction, config) {
        const channel = interaction.options.getChannel('channel');

        // Verify bot permissions in the logs channel
        if (!channel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'ViewChannel', 'EmbedLinks'])) {
            return await interaction.reply({
                content: '❌ I need permissions to send messages, view the channel, and embed links in the logs channel!',
                ephemeral: true
            });
        }

        await ticketService.updateConfig(interaction.guild.id, {
            'settings.logsChannelId': channel.id
        });

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Ticket Logs Channel Updated')
            .setDescription(`Ticket logs will now be sent to ${channel}`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

        // Send test log to verify channel
        const testEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🔔 Ticket Logs Test')
            .setDescription('This channel has been set as the ticket logs channel.')
            .setTimestamp();

        await channel.send({ embeds: [testEmbed] });
    },

    async setMessages(interaction, config) {
        const type = interaction.options.getString('type');
        const message = interaction.options.getString('message');

        const updates = {};
        if (type === 'welcome') {
            updates['settings.welcomeMessage'] = message;
        } else if (type === 'close') {
            updates['settings.closeMessage'] = message;
        }

        await ticketService.updateConfig(interaction.guild.id, updates);

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Ticket Message Updated')
            .addFields(
                { 
                    name: 'Message Type', 
                    value: type === 'welcome' ? 'Welcome Message' : 'Close Message', 
                    inline: true 
                },
                { 
                    name: 'New Message', 
                    value: message, 
                    inline: false 
                }
            );

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}; 