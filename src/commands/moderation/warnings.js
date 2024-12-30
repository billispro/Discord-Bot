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

const WARN_LEVELS = {
    MINOR: { points: 1, color: '#ffff00', label: 'Minor', emoji: '⚠️' },
    MODERATE: { points: 2, color: '#ffa500', label: 'Moderate', emoji: '⛔' },
    MAJOR: { points: 3, color: '#ff0000', label: 'Major', emoji: '🚫' }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('View warning history for a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to check warnings for')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('all')
                .setDescription('Show all warnings including inactive ones')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('silent')
                .setDescription('Show the response only to you')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const silent = interaction.options.getBoolean('silent') ?? true;
            await interaction.deferReply({ ephemeral: silent });

            const targetUser = interaction.options.getUser('target');
            const showAll = interaction.options.getBoolean('all') ?? false;
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            // Fetch warnings
            const warnings = await warningService.getUserWarnings(targetUser.id, interaction.guild.id, !showAll);
            const totalPoints = await warningService.calculateUserPoints(targetUser.id, interaction.guild.id);

            // Create main embed
            const mainEmbed = new EmbedBuilder()
                .setColor(this.getColorBasedOnPoints(totalPoints))
                .setTitle(`Warning History for ${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    {
                        name: '👤 User Information',
                        value: [
                            `**User:** ${targetUser.tag} (${targetUser.id})`,
                            `**Joined:** ${targetMember ? `<t:${Math.floor(targetMember.joinedAt.getTime() / 1000)}:R>` : 'Not in server'}`,
                            `**Account Created:** <t:${Math.floor(targetUser.createdAt.getTime() / 1000)}:R>`,
                            `**Current Points:** ${totalPoints}`
                        ].join('\n'),
                        inline: false
                    }
                )
                .setTimestamp();

            // Add warning summary
            if (warnings.length > 0) {
                const summary = this.generateWarningSummary(warnings);
                mainEmbed.addFields({
                    name: '📊 Warning Summary',
                    value: summary,
                    inline: false
                });

                // Add recent warnings (up to 5)
                const recentWarnings = warnings.slice(0, 5);
                const warningsField = recentWarnings.map((warn, index) => this.formatWarning(warn, index + 1)).join('\n\n');
                
                mainEmbed.addFields({
                    name: `📜 Recent Warnings (${warnings.length} total)`,
                    value: warningsField,
                    inline: false
                });
            } else {
                mainEmbed.setDescription('✨ This user has no warnings!');
            }

            // Create navigation buttons if there are more than 5 warnings
            let components = [];
            if (warnings.length > 5) {
                const buttons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev_page')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(warnings.length <= 5)
                    );
                components.push(buttons);
            }

            const response = await interaction.editReply({
                embeds: [mainEmbed],
                components
            });

            // Handle pagination if needed
            if (warnings.length > 5) {
                await this.handlePagination(response, warnings, interaction, targetUser);
            }

        } catch (error) {
            console.error('Error in warnings command:', error);
            await interaction.editReply({
                content: 'There was an error while fetching the warnings!',
                ephemeral: true
            });
        }
    },

    generateWarningSummary(warnings) {
        const summary = {
            MINOR: 0,
            MODERATE: 0,
            MAJOR: 0
        };

        warnings.forEach(warn => {
            summary[warn.level]++;
        });

        return Object.entries(summary)
            .map(([level, count]) => {
                if (count === 0) return null;
                return `${WARN_LEVELS[level].emoji} **${WARN_LEVELS[level].label}:** ${count}`;
            })
            .filter(Boolean)
            .join('\n') || 'No active warnings';
    },

    formatWarning(warning, index) {
        const level = WARN_LEVELS[warning.level];
        return [
            `**${index}.** ${level.emoji} ${level.label} Warning`,
            `**Reason:** ${warning.reason}`,
            `**Moderator:** <@${warning.moderatorId}>`,
            `**Date:** <t:${Math.floor(new Date(warning.createdAt).getTime() / 1000)}:F>`,
            `**Points:** ${warning.points}`,
            warning.evidence ? `**Evidence:** ${warning.evidence}` : null
        ].filter(Boolean).join('\n');
    },

    getColorBasedOnPoints(points) {
        if (points >= 7) return '#ff0000';
        if (points >= 4) return '#ffa500';
        if (points >= 1) return '#ffff00';
        return '#00ff00';
    },

    async handlePagination(response, warnings, interaction, targetUser) {
        let currentPage = 0;
        const totalPages = Math.ceil(warnings.length / 5);

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300000 // 5 minutes
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({
                    content: 'Only the command executor can use these buttons.',
                    ephemeral: true
                });
            }

            await i.deferUpdate();

            if (i.customId === 'prev_page') currentPage--;
            else if (i.customId === 'next_page') currentPage++;

            const startIndex = currentPage * 5;
            const pageWarnings = warnings.slice(startIndex, startIndex + 5);
            const warningsField = pageWarnings.map((warn, index) => 
                this.formatWarning(warn, startIndex + index + 1)
            ).join('\n\n');

            const pageEmbed = new EmbedBuilder()
                .setColor(this.getColorBasedOnPoints(warnings.reduce((sum, w) => sum + w.points, 0)))
                .setTitle(`Warning History for ${targetUser.tag}`)
                .setDescription(`Page ${currentPage + 1}/${totalPages}`)
                .addFields({
                    name: `📜 Warnings ${startIndex + 1}-${Math.min(startIndex + 5, warnings.length)} of ${warnings.length}`,
                    value: warningsField
                })
                .setTimestamp();

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === totalPages - 1)
                );

            await i.editReply({
                embeds: [pageEmbed],
                components: [buttons]
            });
        });

        collector.on('end', async () => {
            const disabledButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

            await response.edit({
                components: [disabledButtons]
            }).catch(() => {});
        });
    }
}; 