const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder,
    ComponentType
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user with advanced options')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option =>
            option
                .setName('userid')
                .setDescription('The ID of the user to unban')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('The reason for unbanning')
                .setRequired(false))
        .addBooleanOption(option =>
            option
                .setName('silent')
                .setDescription('Whether to unban silently (only visible to moderators)')
                .setRequired(false))
        .addBooleanOption(option =>
            option
                .setName('dm')
                .setDescription('Whether to send a DM to the user about their unban')
                .setRequired(false)),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: interaction.options.getBoolean('silent') ?? false });

            const userId = interaction.options.getString('userid');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const shouldDM = interaction.options.getBoolean('dm') ?? true;

            // Fetch ban information
            const banInfo = await this.fetchBanInfo(interaction.guild, userId);
            if (!banInfo.success) {
                return await interaction.editReply({
                    content: banInfo.message,
                    ephemeral: true
                });
            }

            // Create confirmation embed with ban details
            const confirmEmbed = await this.createConfirmationEmbed(banInfo.ban, reason, interaction);

            // Create action buttons
            const buttons = this.createActionButtons();

            const response = await interaction.editReply({
                embeds: [confirmEmbed],
                components: [buttons]
            });

            // Handle button interactions
            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 30000
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({
                        content: '⚠️ Only the command executor can use these buttons.',
                        ephemeral: true
                    });
                }

                await i.deferUpdate();

                if (i.customId === 'confirm-unban') {
                    await this.executeUnban(interaction, banInfo.ban, reason, shouldDM);
                } else if (i.customId === 'cancel-unban') {
                    await this.cancelUnban(interaction, banInfo.ban.user);
                }

                collector.stop();
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await this.handleTimeout(interaction);
                }
            });

        } catch (error) {
            console.error('Error in unban command:', error);
            await this.handleError(interaction, error);
        }
    },

    async fetchBanInfo(guild, userId) {
        try {
            const bans = await guild.bans.fetch();
            const ban = bans.get(userId);

            if (!ban) {
                return {
                    success: false,
                    message: '❌ This user is not banned from this server.'
                };
            }

            return {
                success: true,
                ban: ban
            };
        } catch (error) {
            console.error('Error fetching ban info:', error);
            return {
                success: false,
                message: '❌ Error fetching ban information. Please check if the ID is valid.'
            };
        }
    },

    async createConfirmationEmbed(ban, reason, interaction) {
        // Fetch the user's ban history
        const banHistory = await this.fetchBanHistory(interaction.guild, ban.user.id);

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🔓 Unban Confirmation')
            .setDescription(`Please confirm the unban of ${ban.user.tag}`)
            .addFields(
                {
                    name: '👤 User Information',
                    value: [
                        `**User:** ${ban.user.tag} (${ban.user.id})`,
                        `**Account Created:** <t:${Math.floor(ban.user.createdAt.getTime() / 1000)}:R>`,
                        `**Original Ban Reason:** ${ban.reason || 'No reason provided'}`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🔨 Unban Details',
                    value: [
                        `**New Reason:** ${reason}`,
                        `**Unbanned By:** ${interaction.user.tag}`,
                        `**Date:** <t:${Math.floor(Date.now() / 1000)}:F>`
                    ].join('\n'),
                    inline: false
                }
            )
            .setThumbnail(ban.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTimestamp();

        // Add ban history if available
        if (banHistory.length > 0) {
            embed.addFields({
                name: '📜 Ban History',
                value: banHistory.map((record, index) => 
                    `**${index + 1}.** ${record.reason || 'No reason'} (<t:${Math.floor(record.date.getTime() / 1000)}:R>)`
                ).join('\n'),
                inline: false
            });
        }

        return embed;
    },

    createActionButtons() {
        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm-unban')
            .setLabel('Confirm Unban')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔓');

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel-unban')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✖️');

        return new ActionRowBuilder().addComponents(confirmButton, cancelButton);
    },

    async executeUnban(interaction, ban, reason, shouldDM) {
        try {
            // Unban the user
            await interaction.guild.members.unban(ban.user.id, `${reason} | Unbanned by ${interaction.user.tag}`);

            // Try to DM the user if enabled
            if (shouldDM) {
                await this.sendUnbanDM(ban.user, interaction);
            }

            // Create success embed
            const successEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ User Successfully Unbanned')
                .addFields(
                    { name: 'Unbanned User', value: `${ban.user.tag} (${ban.user.id})`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'DM Notification', value: shouldDM ? 'Sent' : 'Disabled', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({
                embeds: [successEmbed],
                components: []
            });

            // Log the unban
            await this.logUnban(interaction, ban.user, reason);

        } catch (error) {
            throw error;
        }
    },

    async sendUnbanDM(user, interaction) {
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle(`You have been unbanned from ${interaction.guild.name}`)
                .setDescription('You can now rejoin the server.')
                .addFields(
                    { name: 'Unbanned By', value: interaction.user.tag },
                    { name: 'Server', value: interaction.guild.name }
                )
                .setTimestamp();

            await user.send({ embeds: [dmEmbed] });
        } catch (error) {
            console.log(`Could not DM user ${user.tag}`);
        }
    },

    async logUnban(interaction, user, reason) {
        const logChannel = interaction.guild.channels.cache.find(
            channel => channel.name === 'mod-logs' || channel.name === 'unban-logs'
        );

        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Member Unbanned')
                .addFields(
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                )
                .setFooter({ text: 'Unban Log' })
                .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] });
        }
    },

    async fetchBanHistory(guild, userId) {
        try {
            // This would ideally be connected to a database to store historical bans
            // For now, we can only see the current ban
            const ban = await guild.bans.fetch(userId).catch(() => null);
            return ban ? [{ reason: ban.reason, date: new Date() }] : [];
        } catch (error) {
            console.error('Error fetching ban history:', error);
            return [];
        }
    },

    async cancelUnban(interaction, user) {
        const cancelEmbed = new EmbedBuilder()
            .setColor('#ff9966')
            .setTitle('Unban Cancelled')
            .setDescription(`Unban command for ${user.tag} was cancelled by ${interaction.user.tag}`)
            .setTimestamp();

        await interaction.editReply({
            embeds: [cancelEmbed],
            components: []
        });
    },

    async handleTimeout(interaction) {
        const timeoutEmbed = new EmbedBuilder()
            .setColor('#ff9966')
            .setTitle('Unban Command Timed Out')
            .setDescription('The unban command has expired. Please run the command again if you still want to unban the user.')
            .setTimestamp();

        await interaction.editReply({
            embeds: [timeoutEmbed],
            components: []
        });
    },

    async handleError(interaction, error) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Error Executing Unban')
            .setDescription('An error occurred while trying to unban the user.')
            .addFields({
                name: 'Error Details',
                value: `\`\`\`${error.message}\`\`\``
            })
            .setTimestamp();

        await interaction.editReply({
            embeds: [errorEmbed],
            components: []
        });
    }
}; 