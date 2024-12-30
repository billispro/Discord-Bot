const Ticket = require('../models/Ticket');
const TicketConfig = require('../models/TicketConfig');
const TicketLog = require('../models/TicketLog');
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

// Cooldown cache for ticket creation
const ticketCooldowns = new Map();

class TicketService {
    constructor() {
        this.client = null;
    }

    // Add this method to initialize the client
    setClient(client) {
        this.client = client;
    }

    /**
     * Setup ticket system for a guild
     * @param {Object} config - Configuration object
     */
    async setupSystem(config) {
        try {
            await TicketConfig.findOneAndUpdate(
                { guildId: config.guildId },
                config,
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error('Error setting up ticket system:', error);
            throw error;
        }
    }

    /**
     * Get ticket configuration for a guild
     * @param {string} guildId - Guild ID
     */
    async getConfig(guildId) {
        try {
            return await TicketConfig.findOne({ guildId });
        } catch (error) {
            console.error('Error getting ticket config:', error);
            throw error;
        }
    }

    /**
     * Create a new ticket
     * @param {Object} ticketData - Ticket data
     * @param {Object} guild - Discord guild object
     */
    async createTicket(ticketData, guild) {
        try {
            // Check permissions first
            const canCreate = await this.canCreateTicket(ticketData.userId, guild.id);
            if (!canCreate.allowed) {
                throw new Error(canCreate.reason);
            }

            const config = await this.getConfig(guild.id);
            if (!config) {
                throw new Error('Ticket system is not configured for this server.');
            }

            const ticketCount = await Ticket.countDocuments({ guildId: guild.id });
            const ticketNumber = (ticketCount + 1).toString().padStart(4, '0');
            const ticketId = `TICKET-${ticketNumber}`;

            // Create ticket channel
            const channel = await this.createTicketChannel(ticketId, ticketData, guild, config);

            // Create ticket in database
            const ticket = await Ticket.create({
                ticketId,
                guildId: guild.id,
                channelId: channel.id,
                userId: ticketData.userId,
                category: ticketData.category || 'GENERAL',
                subject: ticketData.subject || 'New Ticket',
                description: ticketData.description || 'No description provided'
            });

            // Only set cooldown after successful creation
            const cooldownKey = `${ticketData.userId}-${guild.id}`;
            const cooldownMinutes = config.settings?.ticketCooldown || 5;
            ticketCooldowns.set(cooldownKey, Date.now() + (cooldownMinutes * 60 * 1000));

            await this.sendWelcomeMessage(channel, ticket, config);

            await this.logTicketAction({
                guildId: guild.id,
                ticketId: ticket.ticketId,
                action: 'CREATE',
                userId: ticketData.userId,
                channelId: channel.id,
                category: ticketData.category,
                subject: ticketData.subject,
                description: ticketData.description,
                priority: ticketData.priority
            });

            return ticket;
        } catch (error) {
            // If error is not a cooldown message, remove any existing cooldown
            if (!error.message.includes('wait')) {
                const cooldownKey = `${ticketData.userId}-${guild.id}`;
                ticketCooldowns.delete(cooldownKey);
            }
            throw error;
        }
    }

    /**
     * Create ticket channel with proper permissions
     * @private
     */
    async createTicketChannel(ticketId, ticketData, guild, config) {
        const category = guild.channels.cache.get(config.categoryId);
        const supportRole = guild.roles.cache.get(config.supportRoleId);
        const user = await guild.members.fetch(ticketData.userId);

        const channelName = ticketId.toLowerCase().replace('ticket-', '');

        return await guild.channels.create({
            name: `ticket-${channelName}`,
            type: 0,
            parent: category,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                    id: supportRole.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory
                    ]
                },
                {
                    id: user.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory
                    ]
                }
            ]
        });
    }

    /**
     * Send welcome message in ticket channel
     * @private
     */
    async sendWelcomeMessage(channel, ticket, config) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Ticket: ${ticket.ticketId}`)
            .setDescription(config.settings.welcomeMessage || 'Thank you for creating a ticket. Support staff will be with you shortly.')
            .addFields(
                { name: 'Created By', value: `<@${ticket.userId}>`, inline: true },
                { name: 'Category', value: ticket.category, inline: true },
                { name: 'Subject', value: ticket.subject },
                { name: 'Priority', value: `${this.getPriorityEmoji(ticket.priority)} ${ticket.priority || 'MEDIUM'}`, inline: true }
            )
            .setTimestamp();

        const buttons = {
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 1,
                            label: 'Claim Ticket',
                            custom_id: 'claim_ticket',
                            emoji: '✋'
                        },
                        {
                            type: 2,
                            style: 4,
                            label: 'Close Ticket',
                            custom_id: 'close_ticket',
                            emoji: '🔒'
                        }
                    ]
                }
            ]
        };

        await channel.send({ embeds: [embed], components: buttons.components });
    }

    /**
     * Close a ticket
     * @param {string} ticketId - Ticket ID
     * @param {string} closedBy - User ID who closed the ticket
     * @param {string} reason - Close reason
     */
    async closeTicket(ticketId, closedBy, reason) {
        try {
            const ticket = await Ticket.findOneAndUpdate(
                { ticketId },
                {
                    status: 'CLOSED',
                    closedAt: new Date(),
                    'metadata.closedBy': closedBy,
                    'metadata.closeReason': reason
                },
                { new: true }
            );

            if (ticket.metadata.reopenCount > 0) {
                await this.createTranscript(ticket);
            }

            await this.logTicketAction({
                guildId: ticket.guildId,
                ticketId: ticket.ticketId,
                action: 'CLOSE',
                userId: closedBy,
                reason: reason,
                metadata: {
                    createdAt: ticket.createdAt,
                    channelId: ticket.channelId,
                    category: ticket.category
                }
            });

            return ticket;
        } catch (error) {
            console.error('Error closing ticket:', error);
            throw error;
        }
    }

    /**
     * Create ticket transcript
     * @private
     */
    async createTranscript(ticket) {
        // Implementation for creating and saving transcript
        // This would typically involve fetching all messages and formatting them
    }

    /**
     * Get user's active tickets
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     */
    async getUserTickets(userId, guildId) {
        try {
            return await Ticket.find({
                userId,
                guildId,
                status: { $ne: 'CLOSED' }
            }).sort({ createdAt: -1 });
        } catch (error) {
            console.error('Error getting user tickets:', error);
            throw error;
        }
    }

    /**
     * Get ticket by channel ID
     * @param {string} channelId - Channel ID
     */
    async getTicketByChannelId(channelId) {
        try {
            return await Ticket.findOne({ channelId });
        } catch (error) {
            console.error('Error getting ticket by channel:', error);
            throw error;
        }
    }

    /**
     * Claim a ticket
     * @param {string} channelId - Channel ID
     * @param {string} userId - User ID claiming the ticket
     */
    async claimTicket(channelId, userId) {
        try {
            return await Ticket.findOneAndUpdate(
                { channelId },
                { 
                    assignedTo: userId,
                    status: 'IN_PROGRESS',
                    'metadata.lastActivity': new Date()
                },
                { new: true }
            );
        } catch (error) {
            console.error('Error claiming ticket:', error);
            throw error;
        }
    }

    /**
     * Check if user can create a ticket
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     */
    async canCreateTicket(userId, guildId) {
        try {
            const cooldownKey = `${userId}-${guildId}`;
            const cooldownTime = ticketCooldowns.get(cooldownKey);
            const config = await this.getConfig(guildId);

            if (!config) {
                return {
                    allowed: false,
                    reason: 'Ticket system is not configured for this server.'
                };
            }

            // Check existing cooldown
            if (cooldownTime && Date.now() < cooldownTime) {
                const remainingTime = Math.ceil((cooldownTime - Date.now()) / 1000);
                return {
                    allowed: false,
                    reason: `Please wait ${remainingTime} seconds before creating another ticket.`
                };
            }

            // Check maximum open tickets
            const openTickets = await Ticket.countDocuments({
                userId,
                guildId,
                status: { $ne: 'CLOSED' }
            });

            const maxTickets = config.settings?.maxOpenTickets || 3;
            if (openTickets >= maxTickets) {
                return {
                    allowed: false,
                    reason: `You can only have ${maxTickets} open tickets at a time.`
                };
            }

            return { allowed: true };
        } catch (error) {
            console.error('Error checking ticket creation permission:', error);
            return {
                allowed: false,
                reason: 'An error occurred while checking permissions.'
            };
        }
    }

    /**
     * Log a ticket-related action
     * @param {Object} logData - Log data
     */
    async logTicketAction(logData) {
        try {
            if (!this.client) {
                console.warn('Discord client not initialized in TicketService');
                return;
            }

            const log = await TicketLog.create({
                guildId: logData.guildId,
                ticketId: logData.ticketId,
                action: logData.action,
                userId: logData.userId,
                targetId: logData.targetId,
                moderatorId: logData.moderatorId,
                reason: logData.reason,
                metadata: {
                    channelId: logData.channelId,
                    category: logData.category,
                    assignedTo: logData.assignedTo,
                    tickets: logData.tickets,
                    subject: logData.subject,
                    description: logData.description,
                    priority: logData.priority
                }
            });

            // Send log to ticket-logs channel if configured
            const config = await this.getConfig(logData.guildId);
            if (config?.settings?.logsChannelId) {
                try {
                    const channel = await this.client.channels.fetch(config.settings.logsChannelId);
                    if (channel) {
                        const embed = this.createDetailedLogEmbed(log);
                        await channel.send({ embeds: [embed] });
                    }
                } catch (error) {
                    console.error('Error sending log to channel:', error);
                }
            }

            return log;
        } catch (error) {
            console.error('Error logging ticket action:', error);
            throw error;
        }
    }

    /**
     * Create embed for ticket log
     * @private
     */
    createDetailedLogEmbed(log) {
        const colors = {
            CREATE: '#00ff00',    // Green
            CLOSE: '#ff0000',     // Red
            CLAIM: '#0099ff',     // Blue
            UNCLAIM: '#ff9900',   // Orange
            REOPEN: '#00ff99',    // Mint
            DELETE: '#ff0000',    // Red
            UPDATE_PRIORITY: '#ffff00'  // Yellow
        };

        const embed = new EmbedBuilder()
            .setColor(colors[log.action] || '#ffffff')
            .setTitle(`Ticket ${log.action}`)
            .setTimestamp(log.createdAt);

        const fields = [];

        switch (log.action) {
            case 'CREATE':
                embed.setDescription('🎫 New ticket created');
                if (log.userId) fields.push({ name: 'Created By', value: `<@${log.userId}>`, inline: true });
                if (log.ticketId) fields.push({ name: 'Ticket ID', value: log.ticketId, inline: true });
                if (log.metadata?.channelId) fields.push({ name: 'Channel', value: `<#${log.metadata.channelId}>`, inline: true });
                if (log.metadata?.category) fields.push({ name: 'Category', value: log.metadata.category, inline: true });
                if (log.metadata?.subject) fields.push({ name: 'Subject', value: log.metadata.subject, inline: false });
                break;

            case 'CLOSE':
                embed.setDescription('🔒 Ticket closed');
                if (log.userId) fields.push({ name: 'Closed By', value: `<@${log.userId}>`, inline: true });
                if (log.ticketId) fields.push({ name: 'Ticket ID', value: log.ticketId, inline: true });
                if (log.reason) fields.push({ name: 'Reason', value: log.reason, inline: false });
                break;

            case 'CLAIM':
                embed.setDescription('✋ Ticket claimed');
                if (log.userId) fields.push({ name: 'Claimed By', value: `<@${log.userId}>`, inline: true });
                if (log.ticketId) fields.push({ name: 'Ticket ID', value: log.ticketId, inline: true });
                if (log.metadata?.channelId) fields.push({ name: 'Channel', value: `<#${log.metadata.channelId}>`, inline: true });
                break;

            case 'UPDATE_PRIORITY':
                embed.setDescription('⚡ Ticket priority updated');
                if (log.userId) fields.push({ name: 'Updated By', value: `<@${log.userId}>`, inline: true });
                if (log.ticketId) fields.push({ name: 'Ticket ID', value: log.ticketId, inline: true });
                if (log.metadata?.oldPriority) fields.push({ name: 'Old Priority', value: log.metadata.oldPriority, inline: true });
                if (log.metadata?.newPriority) fields.push({ name: 'New Priority', value: log.metadata.newPriority, inline: true });
                break;

            default:
                embed.setDescription(`Action: ${log.action}`);
                if (log.userId) fields.push({ name: 'User', value: `<@${log.userId}>`, inline: true });
                if (log.ticketId) fields.push({ name: 'Ticket ID', value: log.ticketId, inline: true });
        }

        // Only add fields that exist
        if (fields.length > 0) {
            embed.addFields(fields);
        }

        return embed;
    }

    /**
     * Get ticket logs for a guild
     * @param {string} guildId - Guild ID
     * @param {Object} options - Query options
     */
    async getTicketLogs(guildId, options = {}) {
        const query = { guildId };
        
        if (options.ticketId) query.ticketId = options.ticketId;
        if (options.userId) query.userId = options.userId;
        if (options.action) query.action = options.action;
        
        const logs = await TicketLog.find(query)
            .sort({ createdAt: -1 })
            .limit(options.limit || 100);

        return logs;
    }

    async updateConfig(guildId, updates) {
        try {
            return await TicketConfig.findOneAndUpdate(
                { guildId },
                { $set: updates },
                { new: true }
            );
        } catch (error) {
            console.error('Error updating ticket config:', error);
            throw error;
        }
    }

    async updateTicketPriority(ticketId, priority, userId) {
        try {
            const ticket = await Ticket.findOneAndUpdate(
                { ticketId },
                { 
                    priority,
                    'metadata.lastActivity': new Date()
                },
                { new: true }
            );

            await this.logTicketAction({
                guildId: ticket.guildId,
                ticketId: ticket.ticketId,
                action: 'UPDATE_PRIORITY',
                userId,
                metadata: {
                    oldPriority: ticket.priority,
                    newPriority: priority
                }
            });

            return ticket;
        } catch (error) {
            console.error('Error updating ticket priority:', error);
            throw error;
        }
    }

    getPriorityEmoji(priority = 'MEDIUM') {
        const emojis = {
            LOW: '🟢',
            MEDIUM: '🟡',
            HIGH: '🟠',
            URGENT: '🔴'
        };
        return emojis[priority] || emojis.MEDIUM;
    }

    // Additional methods as needed...
}

// Create a single instance
const ticketService = new TicketService();
module.exports = ticketService; 