const mongoose = require('mongoose');

/**
 * Ticket Configuration Schema
 * Stores guild-specific ticket system settings
 */
const ticketConfigSchema = new mongoose.Schema({
    // Discord guild ID
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    // Channel where ticket panel is displayed
    channelId: {
        type: String,
        required: true
    },
    // Category where tickets are created
    categoryId: {
        type: String,
        required: true
    },
    // Support team role ID
    supportRoleId: {
        type: String,
        required: true
    },
    // Ticket categories/types
    categories: [{
        name: String,
        description: String,
        emoji: String,
        supportRoles: [String], // Additional role IDs for specific categories
        autoAssign: Boolean,
        maxTickets: Number
    }],
    // Ticket settings
    settings: {
        maxOpenTickets: {
            type: Number,
            default: 3
        },
        ticketNameFormat: {
            type: String,
            default: 'ticket-{number}'
        },
        autoClose: {
            enabled: {
                type: Boolean,
                default: true
            },
            inactivityDays: {
                type: Number,
                default: 3
            }
        },
        transcripts: {
            enabled: {
                type: Boolean,
                default: true
            },
            channelId: String
        },
        welcomeMessage: String,
        closeMessage: String,
        ticketCooldown: {
            type: Number,
            default: 5 // minutes
        },
        logsChannelId: {
            type: String,
            default: null
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamps on save
ticketConfigSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('TicketConfig', ticketConfigSchema); 