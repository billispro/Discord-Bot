const mongoose = require('mongoose');

/**
 * Ticket Schema
 * Stores information about support tickets
 */
const ticketSchema = new mongoose.Schema({
    // Unique ticket identifier (e.g., TICKET-0001)
    ticketId: {
        type: String,
        required: true,
        unique: true
    },
    // Discord guild ID
    guildId: {
        type: String,
        required: true,
        index: true
    },
    // Channel ID where the ticket exists
    channelId: {
        type: String,
        required: true,
        unique: true
    },
    // User who created the ticket
    userId: {
        type: String,
        required: true,
        index: true
    },
    // Support staff assigned to the ticket
    assignedTo: {
        type: String,
        default: null
    },
    // Ticket status
    status: {
        type: String,
        enum: ['OPEN', 'CLOSED', 'ON_HOLD', 'IN_PROGRESS'],
        default: 'OPEN',
        index: true
    },
    // Ticket priority
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM',
        index: true
    },
    // Ticket category/type
    category: {
        type: String,
        required: true,
        index: true
    },
    // Ticket subject/title
    subject: {
        type: String,
        required: true
    },
    // Initial ticket description
    description: {
        type: String,
        required: true
    },
    // Array of message references for transcript
    messages: [{
        messageId: String,
        userId: String,
        content: String,
        timestamp: Date,
        attachments: [{
            url: String,
            name: String
        }]
    }],
    // Ticket metadata
    metadata: {
        closedBy: String,
        closeReason: String,
        reopenedBy: String,
        reopenCount: {
            type: Number,
            default: 0
        },
        lastActivity: Date,
        resolution: String,
        tags: [String]
    },
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    closedAt: Date
});

// Indexes for common queries
ticketSchema.index({ guildId: 1, status: 1 });
ticketSchema.index({ guildId: 1, userId: 1 });
ticketSchema.index({ guildId: 1, assignedTo: 1, status: 1 });

// Update timestamps on save
ticketSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Ticket', ticketSchema); 