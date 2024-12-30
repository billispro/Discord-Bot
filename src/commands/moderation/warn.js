const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder,
    ComponentType
} = require('discord.js');
const warningService = require('../../services/warningService');

// Warning levels configuration with their respective points and visual settings
const WARN_LEVELS = {
    MINOR: { points: 1, color: '#ffff00', label: 'Minor', emoji: '⚠️' },
    MODERATE: { points: 2, color: '#ffa500', label: 'Moderate', emoji: '⛔' },
    MAJOR: { points: 3, color: '#ff0000', label: 'Major', emoji: '🚫' }
};

// Punishment thresholds and their corresponding actions
const PUNISHMENT_THRESHOLDS = [
    { points: 3, action: 'MUTE', duration: '1h' },
    { points: 5, action: 'MUTE', duration: '24h' },
    { points: 7, action: 'KICK' },
    { points: 10, action: 'BAN' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a member with advanced warning system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The member to warn')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for the warning')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('level')
                .setDescription('The severity level of the warning')
                .setRequired(true)
                .addChoices(
                    { name: '⚠️ Minor (1 point)', value: 'MINOR' },
                    { name: '⛔ Moderate (2 points)', value: 'MODERATE' },
                    { name: '🚫 Major (3 points)', value: 'MAJOR' }
                )),

    /**
     * Execute the warn command
     * @param {CommandInteraction} interaction - The interaction object
     */
    async execute(interaction) {
        try {
            await interaction.deferReply();

            const targetMember = interaction.options.getMember('target');
            const reason = interaction.options.getString('reason');
            const level = interaction.options.getString('level');
            
            // Validate the warning
            const validationResult = await this.validateWarn(interaction, targetMember);
            if (!validationResult.success) {
                return await interaction.editReply({
                    content: validationResult.message,
                    ephemeral: true
                });
            }

            // Get user's warning history
            const warningHistory = await warningService.getUserWarnings(targetMember.id, interaction.guild.id);
            const currentPoints = await warningService.calculateUserPoints(targetMember.id, interaction.guild.id);
            const newPoints = currentPoints + WARN_LEVELS[level].points;

            const confirmEmbed = new EmbedBuilder()
                .setColor(WARN_LEVELS[level].color)
                .setTitle('⚠️ Warning Confirmation')
                .setDescription(`Are you sure you want to warn ${targetMember.user.tag}?`)
                .addFields(
                    {
                        name: '👤 User Information',
                        value: [
                            `**Member:** ${targetMember.user.tag} (${targetMember.id})`,
                            `**Joined:** <t:${Math.floor(targetMember.joinedAt.getTime() / 1000)}:R>`,
                            `**Current Points:** ${currentPoints}`,
                            `**New Total Points:** ${newPoints}`
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '📝 Warning Details',
                        value: [
                            `**Level:** ${WARN_LEVELS[level].label}`,
                            `**Points:** +${WARN_LEVELS[level].points}`,
                            `**Reason:** ${reason}`
                        ].join('\n'),
                        inline: false
                    }
                )
                .setTimestamp();

            // Add warning history if exists
            if (warningHistory.length > 0) {
                confirmEmbed.addFields({
                    name: '📜 Warning History',
                    value: warningHistory.map(warn => 
                        `• ${WARN_LEVELS[warn.level].label}: ${warn.reason} (<t:${Math.floor(new Date(warn.createdAt).getTime() / 1000)}:R>)`
                    ).join('\n').slice(0, 1024) || 'No previous warnings'
                });
            }

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm-warn')
                        .setLabel('Confirm Warning')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('⚠️'),
                    new ButtonBuilder()
                        .setCustomId('cancel-warn')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✖️')
                );

            const response = await interaction.editReply({
                embeds: [confirmEmbed],
                components: [buttons]
            });

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

                if (i.customId === 'confirm-warn') {
                    await this.executeWarn(interaction, targetMember, reason, level);
                } else {
                    await this.cancelWarn(interaction, targetMember);
                }

                collector.stop();
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#ff9966')
                        .setTitle('Warning Cancelled')
                        .setDescription('Warning command timed out - no response received within 30 seconds.')
                        .setTimestamp();

                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: []
                    });
                }
            });

        } catch (error) {
            console.error('Error in warn command:', error);
            await interaction.editReply({
                content: 'There was an error while executing this command!',
                ephemeral: true
            });
        }
    },

    /**
     * Generate a summary of warnings by level
     * @param {Array} warnings - Array of warning objects
     * @returns {String} Formatted summary of warnings
     */
    generateWarningSummary(warnings) {
        // ... rest of the code remains the same ...
    },

    /**
     * Format a single warning for display
     * @param {Object} warning - The warning object
     * @param {Number} index - The warning index
     * @returns {String} Formatted warning text
     */
    formatWarning(warning, index) {
        // ... rest of the code remains the same ...
    },

    async validateWarn(interaction, targetMember) {
        if (!targetMember) {
            return { success: false, message: '❌ Unable to find that member in the server.' };
        }

        if (targetMember.id === interaction.user.id) {
            return { success: false, message: '❌ You cannot warn yourself.' };
        }

        if (targetMember.id === interaction.guild.ownerId) {
            return { success: false, message: '❌ You cannot warn the server owner.' };
        }

        if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
            return { success: false, message: '❌ You cannot warn someone with a higher or equal role.' };
        }

        return { success: true };
    },

    async executeWarn(interaction, member, reason, level) {
        try {
            const warning = await warningService.createWarning({
                userId: member.id,
                guildId: interaction.guild.id,
                moderatorId: interaction.user.id,
                reason: reason,
                level: level,
                points: WARN_LEVELS[level].points
            });

            const newPoints = await warningService.calculateUserPoints(member.id, interaction.guild.id);

            const successEmbed = new EmbedBuilder()
                .setColor(WARN_LEVELS[level].color)
                .setTitle('✅ Warning Issued Successfully')
                .addFields(
                    { name: 'Warned User', value: `${member.user.tag} (${member.id})`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Level', value: WARN_LEVELS[level].label, inline: true },
                    { name: 'Total Points', value: `${newPoints}`, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({
                embeds: [successEmbed],
                components: []
            });

            // Try to DM the warned user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(WARN_LEVELS[level].color)
                    .setTitle(`You have been warned in ${interaction.guild.name}`)
                    .addFields(
                        { name: 'Reason', value: reason },
                        { name: 'Warning Level', value: WARN_LEVELS[level].label },
                        { name: 'Total Warning Points', value: `${newPoints}` }
                    )
                    .setTimestamp();

                await member.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log(`Could not DM user ${member.user.tag}`);
            }

        } catch (error) {
            throw error;
        }
    },

    async cancelWarn(interaction, member) {
        const cancelEmbed = new EmbedBuilder()
            .setColor('#ff9966')
            .setTitle('Warning Cancelled')
            .setDescription(`Warning for ${member.user.tag} was cancelled.`)
            .setTimestamp();

        await interaction.editReply({
            embeds: [cancelEmbed],
            components: []
        });
    }
}; 