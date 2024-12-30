const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The member to ban')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('The reason for banning')
                .setRequired(false))
        .addNumberOption(option =>
            option
                .setName('days')
                .setDescription('Number of days of messages to delete (0-7)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false)),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('target');
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const deleteDays = interaction.options.getNumber('days') || 0;

            // Validation helper
            const validationResult = await this.validateBan(interaction, targetMember);
            if (!validationResult.success) {
                return await interaction.editReply({
                    content: validationResult.message,
                    ephemeral: true
                });
            }

            // Create confirmation embed
            const confirmEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⚠️ Ban Confirmation')
                .setDescription(`Are you sure you want to ban ${targetUser.tag}?`)
                .addFields(
                    { name: 'Target', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Reason', value: reason, inline: true },
                    { name: 'Delete Messages', value: `Last ${deleteDays} days`, inline: true }
                )
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();

            // Create confirm and cancel buttons
            const confirmButton = new ButtonBuilder()
                .setCustomId('confirm-ban')
                .setLabel('Confirm Ban')
                .setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel-ban')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder()
                .addComponents(confirmButton, cancelButton);

            const response = await interaction.editReply({
                embeds: [confirmEmbed],
                components: [row]
            });

            // Create button collector
            const collector = response.createMessageComponentCollector({
                time: 15000 // 15 seconds
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({
                        content: '❌ Only the command executor can use these buttons.',
                        ephemeral: true
                    });
                }

                await i.deferUpdate();

                if (i.customId === 'confirm-ban') {
                    try {
                        // Execute the ban
                        await targetMember.ban({
                            reason: `${reason} | Banned by ${interaction.user.tag}`,
                            deleteMessageDays: deleteDays
                        });

                        // Create success embed
                        const successEmbed = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('✅ Member Banned Successfully')
                            .addFields(
                                { name: 'Banned User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                                { name: 'Banned By', value: `${interaction.user.tag}`, inline: true },
                                { name: 'Reason', value: reason, inline: true },
                                { name: 'Messages Deleted', value: `Last ${deleteDays} days`, inline: true }
                            )
                            .setTimestamp();

                        // Try to DM the banned user
                        try {
                            const dmEmbed = new EmbedBuilder()
                                .setColor('#ff0000')
                                .setTitle(`You have been banned from ${interaction.guild.name}`)
                                .addFields(
                                    { name: 'Reason', value: reason },
                                    { name: 'Banned By', value: interaction.user.tag }
                                )
                                .setTimestamp();

                            await targetUser.send({ embeds: [dmEmbed] });
                        } catch (error) {
                            console.log(`Could not DM user ${targetUser.tag}`);
                        }

                        await interaction.editReply({
                            embeds: [successEmbed],
                            components: []
                        });

                    } catch (error) {
                        console.error('Error while banning:', error);
                        await interaction.editReply({
                            content: '❌ An error occurred while trying to ban the user.',
                            embeds: [],
                            components: []
                        });
                    }
                } else if (i.customId === 'cancel-ban') {
                    const cancelEmbed = new EmbedBuilder()
                        .setColor('#ff9966')
                        .setTitle('Ban Cancelled')
                        .setDescription(`Ban command for ${targetUser.tag} was cancelled.`)
                        .setTimestamp();

                    await interaction.editReply({
                        embeds: [cancelEmbed],
                        components: []
                    });
                }

                collector.stop();
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#ff9966')
                        .setTitle('Ban Cancelled')
                        .setDescription('Ban command timed out - no response received within 15 seconds.')
                        .setTimestamp();

                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: []
                    });
                }
            });

        } catch (error) {
            console.error('Error in ban command:', error);
            await interaction.editReply({
                content: 'There was an error while executing this command!',
                ephemeral: true
            });
        }
    },

    // Validation helper
    async validateBan(interaction, targetMember) {
        if (!targetMember) {
            return { success: false, message: '❌ Unable to find that member in the server.' };
        }

        if (!targetMember.bannable) {
            return { success: false, message: '❌ I cannot ban this user due to role hierarchy or missing permissions.' };
        }

        // Fixed role hierarchy check
        if (targetMember.roles.highest.position >= interaction.member.roles.highest.position && interaction.member.id !== interaction.guild.ownerId) {
            return { success: false, message: '❌ You cannot ban this user as they have the same or higher role than you.' };
        }

        if (targetMember.id === interaction.guild.ownerId) {
            return { success: false, message: '❌ You cannot ban the server owner.' };
        }

        // Add debug information
        console.log('Role Positions:', {
            executor: {
                highestRole: interaction.member.roles.highest.name,
                position: interaction.member.roles.highest.position
            },
            target: {
                highestRole: targetMember.roles.highest.name,
                position: targetMember.roles.highest.position
            }
        });

        return { success: true };
    }
}; 