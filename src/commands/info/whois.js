const { 
    SlashCommandBuilder, 
    EmbedBuilder,
    PermissionFlagsBits,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType
} = require('discord.js');
const moment = require('moment');
const warningService = require('../../services/warningService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whois')
        .setDescription('Display detailed information about a user')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to get information about')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('silent')
                .setDescription('Show the response only to you')
                .setRequired(false)),

    /**
     * Execute the whois command
     * @param {CommandInteraction} interaction - The interaction object
     */
    async execute(interaction) {
        try {
            const silent = interaction.options.getBoolean('silent') ?? true;
            await interaction.deferReply({ ephemeral: silent });

            // Get target user or default to command user
            const targetUser = interaction.options.getUser('target') || interaction.user;
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            // Create base embed
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: `User Information - ${targetUser.tag}`,
                    iconURL: targetUser.displayAvatarURL({ dynamic: true })
                })
                .setColor(member ? member.displayHexColor : '#000000')
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }));

            // Basic user information
            embed.addFields({
                name: '👤 Basic Information',
                value: [
                    `**Username:** ${targetUser.tag}`,
                    `**ID:** ${targetUser.id}`,
                    `**Created:** <t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>`,
                    `**Account Age:** ${this.formatDuration(Date.now() - targetUser.createdTimestamp)}`,
                    `**Bot Account:** ${targetUser.bot ? 'Yes' : 'No'}`
                ].join('\n'),
                inline: false
            });

            // Member specific information
            if (member) {
                // Roles information
                const roles = member.roles.cache
                    .sort((a, b) => b.position - a.position)
                    .map(role => role)
                    .filter(role => role.id !== interaction.guild.id);

                embed.addFields(
                    {
                        name: '📋 Server Member Information',
                        value: [
                            `**Nickname:** ${member.nickname || 'None'}`,
                            `**Joined Server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:F>`,
                            `**Join Position:** ${await this.getJoinPosition(interaction.guild, member)}`,
                            `**Server Member For:** ${this.formatDuration(Date.now() - member.joinedTimestamp)}`,
                            `**Timed Out:** ${member.isCommunicationDisabled() ? 'Yes' : 'No'}`
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: `👑 Roles [${roles.length}]`,
                        value: roles.length ? roles.slice(0, 15).join(', ') + (roles.length > 15 ? ` and ${roles.length - 15} more...` : '') : 'No roles',
                        inline: false
                    },
                    {
                        name: '🔑 Key Permissions',
                        value: this.getKeyPermissions(member),
                        inline: false
                    }
                );

                // Add presence information if available
                if (member.presence) {
                    const presenceInfo = this.getPresenceInfo(member);
                    if (presenceInfo) {
                        embed.addFields({
                            name: '🎮 Presence',
                            value: presenceInfo,
                            inline: false
                        });
                    }
                }
            }

            // Create buttons for additional information
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('avatar')
                        .setLabel('Avatar')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🖼️'),
                    new ButtonBuilder()
                        .setCustomId('banner')
                        .setLabel('Banner')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🎨'),
                    new ButtonBuilder()
                        .setCustomId('warnings')
                        .setLabel('Warnings')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚠️')
                );

            const response = await interaction.editReply({
                embeds: [embed],
                components: [buttons]
            });

            // Handle button interactions
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

                switch (i.customId) {
                    case 'avatar':
                        await this.showAvatar(i, targetUser);
                        break;
                    case 'banner':
                        await this.showBanner(i, targetUser);
                        break;
                    case 'warnings':
                        await this.showWarnings(i, targetUser, interaction.guild.id);
                        break;
                }
            });

            collector.on('end', async () => {
                const disabledButtons = new ActionRowBuilder()
                    .addComponents(
                        buttons.components.map(button => 
                            ButtonBuilder.from(button).setDisabled(true)
                        )
                    );

                await interaction.editReply({ components: [disabledButtons] }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in whois command:', error);
            await this.handleError(interaction, error);
        }
    },

    /**
     * Format duration from milliseconds to human readable string
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted duration
     */
    formatDuration(ms) {
        const duration = moment.duration(ms);
        const years = duration.years();
        const months = duration.months();
        const days = duration.days();

        const parts = [];
        if (years) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
        if (months) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
        if (days) parts.push(`${days} day${days !== 1 ? 's' : ''}`);

        return parts.join(', ') || 'Less than a day';
    },

    /**
     * Get member's join position in the guild
     * @param {Guild} guild - The guild object
     * @param {GuildMember} member - The member object
     * @returns {Promise<number>} Join position
     */
    async getJoinPosition(guild, member) {
        const members = await guild.members.fetch();
        return Array.from(members.values())
            .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
            .findIndex(m => m.id === member.id) + 1;
    },

    /**
     * Get key permissions for a member
     * @param {GuildMember} member - The member object
     * @returns {string} Formatted permissions string
     */
    getKeyPermissions(member) {
        const permissions = {
            ADMINISTRATOR: '👑 Administrator',
            MANAGE_GUILD: '⚙️ Manage Server',
            MANAGE_ROLES: '🎭 Manage Roles',
            MANAGE_CHANNELS: '📁 Manage Channels',
            MANAGE_MESSAGES: '📝 Manage Messages',
            MANAGE_WEBHOOKS: '🔗 Manage Webhooks',
            MANAGE_NICKNAMES: '📛 Manage Nicknames',
            MANAGE_EMOJIS_AND_STICKERS: '😄 Manage Emojis',
            KICK_MEMBERS: '👢 Kick Members',
            BAN_MEMBERS: '🔨 Ban Members',
            MENTION_EVERYONE: '📢 Mention Everyone'
        };

        const memberPermissions = member.permissions.toArray();
        const keyPerms = Object.entries(permissions)
            .filter(([perm]) => memberPermissions.includes(perm))
            .map(([, label]) => label);

        return keyPerms.length ? keyPerms.join('\n') : 'No key permissions';
    },

    /**
     * Get presence information for a member
     * @param {GuildMember} member - The member object
     * @returns {string} Formatted presence string
     */
    getPresenceInfo(member) {
        if (!member.presence) return null;

        const status = {
            online: '🟢 Online',
            idle: '🟡 Idle',
            dnd: '🔴 Do Not Disturb',
            offline: '⚫ Offline'
        };

        const activities = member.presence.activities.map(activity => {
            switch (activity.type) {
                case 0: return `🎮 Playing ${activity.name}`;
                case 1: return `🎥 Streaming ${activity.name}`;
                case 2: return `🎵 Listening to ${activity.name}`;
                case 3: return `📺 Watching ${activity.name}`;
                case 4: return `${activity.emoji || '👤'} Custom Status: ${activity.state}`;
                case 5: return `🏆 Competing in ${activity.name}`;
                default: return `${activity.name}`;
            }
        });

        return [
            `**Status:** ${status[member.presence.status]}`,
            activities.length ? `**Activities:**\n${activities.join('\n')}` : null
        ].filter(Boolean).join('\n');
    },

    /**
     * Show user's avatar in a new embed
     * @param {ButtonInteraction} interaction - The button interaction
     * @param {User} user - The target user
     */
    async showAvatar(interaction, user) {
        const avatarEmbed = new EmbedBuilder()
            .setTitle(`${user.tag}'s Avatar`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 4096 }))
            .setColor('#00ff00')
            .setTimestamp();

        await interaction.editReply({ embeds: [avatarEmbed] });
    },

    /**
     * Show user's banner in a new embed
     * @param {ButtonInteraction} interaction - The button interaction
     * @param {User} user - The target user
     */
    async showBanner(interaction, user) {
        const fetchedUser = await user.fetch();
        const bannerEmbed = new EmbedBuilder()
            .setTitle(`${user.tag}'s Banner`)
            .setColor('#00ff00')
            .setTimestamp();

        if (fetchedUser.banner) {
            bannerEmbed.setImage(fetchedUser.bannerURL({ dynamic: true, size: 4096 }));
        } else {
            bannerEmbed.setDescription('This user does not have a banner.');
        }

        await interaction.editReply({ embeds: [bannerEmbed] });
    },

    /**
     * Show user's warnings in a new embed
     * @param {ButtonInteraction} interaction - The button interaction
     * @param {User} user - The target user
     * @param {string} guildId - The guild ID
     */
    async showWarnings(interaction, user, guildId) {
        try {
            const warnings = await warningService.getUserWarnings(user.id, guildId);
            const totalPoints = await warningService.calculateUserPoints(user.id, guildId);

            const warningsEmbed = new EmbedBuilder()
                .setTitle(`Warning History - ${user.tag}`)
                .setColor(totalPoints > 0 ? '#ff0000' : '#00ff00')
                .setTimestamp();

            if (warnings.length > 0) {
                const warningList = warnings.map((warn, index) => 
                    `**${index + 1}.** Level: ${warn.level}\n` +
                    `Reason: ${warn.reason}\n` +
                    `Points: ${warn.points}\n` +
                    `Date: <t:${Math.floor(new Date(warn.createdAt).getTime() / 1000)}:F>`
                ).join('\n\n');

                warningsEmbed
                    .setDescription(`Total Warning Points: ${totalPoints}`)
                    .addFields({
                        name: 'Warning History',
                        value: warningList.slice(0, 1024)
                    });
            } else {
                warningsEmbed.setDescription('This user has no warnings! 🎉');
            }

            await interaction.editReply({ embeds: [warningsEmbed] });
        } catch (error) {
            console.error('Error fetching warnings:', error);
            await this.handleError(interaction, error);
        }
    },

    /**
     * Handle command errors
     * @param {CommandInteraction} interaction - The interaction object
     * @param {Error} error - The error object
     */
    async handleError(interaction, error) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Error')
            .setDescription('An error occurred while fetching user information.')
            .addFields({
                name: 'Error Details',
                value: error.message
            })
            .setTimestamp();

        await interaction.editReply({
            embeds: [errorEmbed],
            components: []
        });
    }
}; 