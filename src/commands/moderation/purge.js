const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType
} = require('discord.js');

/**
 * Purge command for bulk message deletion with advanced filtering
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete multiple messages with advanced filters')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addNumberOption(option => 
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Delete messages only from this user')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of messages to delete')
                .setRequired(false)
                .addChoices(
                    { name: 'All Messages', value: 'ALL' },
                    { name: 'Text Only', value: 'TEXT' },
                    { name: 'Embeds Only', value: 'EMBEDS' },
                    { name: 'Files/Attachments', value: 'FILES' },
                    { name: 'Links', value: 'LINKS' },
                    { name: 'Bots', value: 'BOTS' }
                ))
        .addStringOption(option =>
            option.setName('contains')
                .setDescription('Delete messages containing this text')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('silent')
                .setDescription('Show deletion result only to you')
                .setRequired(false)),

    /**
     * Execute the purge command
     * @param {CommandInteraction} interaction - The interaction object
     */
    async execute(interaction) {
        try {
            const amount = interaction.options.getNumber('amount');
            const user = interaction.options.getUser('user');
            const type = interaction.options.getString('type') || 'ALL';
            const contains = interaction.options.getString('contains');
            const silent = interaction.options.getBoolean('silent') ?? true;

            await interaction.deferReply({ ephemeral: silent });

            // Create confirmation embed with deletion details
            const confirmEmbed = new EmbedBuilder()
                .setColor('#ff9966')
                .setTitle('⚠️ Confirm Message Purge')
                .setDescription('Are you sure you want to delete messages with these filters?')
                .addFields(
                    { name: '🔢 Amount', value: `${amount} messages`, inline: true },
                    { name: '📋 Type', value: type, inline: true },
                    { name: '👤 User Filter', value: user ? `${user.tag}` : 'None', inline: true }
                )
                .setTimestamp();

            if (contains) {
                confirmEmbed.addFields({
                    name: '🔍 Content Filter',
                    value: `Messages containing: "${contains}"`,
                    inline: false
                });
            }

            // Create confirmation buttons
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm-purge')
                        .setLabel('Confirm Delete')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗑️'),
                    new ButtonBuilder()
                        .setCustomId('cancel-purge')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✖️')
                );

            const response = await interaction.editReply({
                embeds: [confirmEmbed],
                components: [buttons]
            });

            // Handle button interactions
            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 15000
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({
                        content: 'Only the command executor can use these buttons.',
                        ephemeral: true
                    });
                }

                await i.deferUpdate();

                if (i.customId === 'confirm-purge') {
                    await this.executePurge(interaction, amount, user, type, contains);
                } else {
                    await this.cancelPurge(interaction);
                }

                collector.stop();
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await this.handleTimeout(interaction);
                }
            });

        } catch (error) {
            console.error('Error in purge command:', error);
            await this.handleError(interaction, error);
        }
    },

    /**
     * Execute the message purge with specified filters
     * @param {CommandInteraction} interaction - The interaction object
     * @param {number} amount - Number of messages to delete
     * @param {User} user - Optional user to filter messages by
     * @param {string} type - Type of messages to filter
     * @param {string} contains - Optional text content to filter by
     */
    async executePurge(interaction, amount, user, type, contains) {
        try {
            // Ensure we don't exceed Discord's limit
            const fetchAmount = Math.min(amount, 100);
            
            // Fetch messages
            const messages = await interaction.channel.messages.fetch({ limit: fetchAmount });
            
            // Apply filters to messages
            let filteredMessages = messages.filter(msg => {
                // Exclude command message
                if (msg.id === interaction.id) return false;
                
                // Apply user filter
                if (user && msg.author.id !== user.id) return false;
                
                // Apply type filter
                switch (type) {
                    case 'TEXT':
                        return !msg.embeds.length && !msg.attachments.size && !this.hasLink(msg.content);
                    case 'EMBEDS':
                        return msg.embeds.length > 0;
                    case 'FILES':
                        return msg.attachments.size > 0;
                    case 'LINKS':
                        return this.hasLink(msg.content);
                    case 'BOTS':
                        return msg.author.bot;
                    default:
                        return true;
                }
            });

            // Apply content filter if specified
            if (contains) {
                filteredMessages = filteredMessages.filter(msg => 
                    msg.content.toLowerCase().includes(contains.toLowerCase())
                );
            }

            // Convert to array and limit to requested amount
            const messagesToDelete = [...filteredMessages.values()].slice(0, amount);

            // Handle case where no messages match filters
            if (messagesToDelete.length === 0) {
                const noMessagesEmbed = new EmbedBuilder()
                    .setColor('#ff9966')
                    .setTitle('No Messages Found')
                    .setDescription('No messages matched your filter criteria.')
                    .setTimestamp();

                return await interaction.editReply({
                    embeds: [noMessagesEmbed],
                    components: []
                });
            }

            // Attempt to delete messages
            const deleted = await interaction.channel.bulkDelete(messagesToDelete, true)
                .catch(error => {
                    if (error.code === 50034) {
                        throw new Error('Cannot delete messages older than 14 days.');
                    }
                    throw error;
                });

            // Create success embed
            const successEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🗑️ Messages Deleted Successfully')
                .addFields(
                    { name: 'Messages Found', value: `${filteredMessages.size}`, inline: true },
                    { name: 'Messages Deleted', value: `${deleted.size}`, inline: true },
                    { name: 'Channel', value: `${interaction.channel.name}`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({
                embeds: [successEmbed],
                components: []
            });

            // Log the purge action
            await this.logPurge(interaction, deleted.size, user, type, contains);

        } catch (error) {
            throw error;
        }
    },

    /**
     * Handle purge cancellation
     * @param {CommandInteraction} interaction - The interaction object
     */
    async cancelPurge(interaction) {
        const cancelEmbed = new EmbedBuilder()
            .setColor('#ff9966')
            .setTitle('Purge Cancelled')
            .setDescription('Message deletion was cancelled.')
            .setTimestamp();

        await interaction.editReply({
            embeds: [cancelEmbed],
            components: []
        });
    },

    /**
     * Handle command timeout
     * @param {CommandInteraction} interaction - The interaction object
     */
    async handleTimeout(interaction) {
        const timeoutEmbed = new EmbedBuilder()
            .setColor('#ff9966')
            .setTitle('Purge Cancelled')
            .setDescription('Command timed out - no response received within 15 seconds.')
            .setTimestamp();

        await interaction.editReply({
            embeds: [timeoutEmbed],
            components: []
        });
    },

    /**
     * Handle command errors
     * @param {CommandInteraction} interaction - The interaction object
     * @param {Error} error - The error object
     */
    async handleError(interaction, error) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Error Executing Purge')
            .setDescription(error.message || 'An error occurred while trying to delete messages.')
            .setTimestamp();

        await interaction.editReply({
            embeds: [errorEmbed],
            components: []
        });
    },

    /**
     * Log purge action to audit log channel
     * @param {CommandInteraction} interaction - The interaction object
     * @param {number} amount - Number of messages deleted
     * @param {User} user - User filter applied (if any)
     * @param {string} type - Type of messages filtered
     * @param {string} contains - Content filter applied (if any)
     */
    async logPurge(interaction, amount, user, type, contains) {
        const logChannel = interaction.guild.channels.cache.find(
            channel => channel.name === 'mod-logs' || channel.name === 'audit-logs'
        );

        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor('#ff9966')
                .setTitle('Messages Purged')
                .addFields(
                    { name: 'Moderator', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                    { name: 'Channel', value: `${interaction.channel.name} (${interaction.channel.id})`, inline: true },
                    { name: 'Amount', value: `${amount} messages`, inline: true },
                    { name: 'Type', value: type, inline: true }
                )
                .setTimestamp();

            if (user) {
                logEmbed.addFields({
                    name: 'Target User',
                    value: `${user.tag} (${user.id})`,
                    inline: true
                });
            }

            if (contains) {
                logEmbed.addFields({
                    name: 'Content Filter',
                    value: contains,
                    inline: true
                });
            }

            await logChannel.send({ embeds: [logEmbed] });
        }
    },

    /**
     * Check if a string contains a URL
     * @param {string} content - The string to check
     * @returns {boolean} True if the string contains a URL
     */
    hasLink(content) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return urlRegex.test(content);
    }
}; 