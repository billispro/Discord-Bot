const mongoose = require('mongoose');

const ticketLogSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    ticketId: String,
    action: {
        type: String,
        required: true,
        enum: [
            'CREATE',
            'CLOSE',
            'CLAIM',
            'UNCLAIM',
            'REOPEN',
            'DELETE',
            'CALL_USER',
            'ADD_USER',
            'REMOVE_USER',
            'UPDATE_PRIORITY'
        ]
    },
    userId: String,         // User who performed the action
    targetId: String,       // Target user (if applicable)
    moderatorId: String,    // Moderator ID (if applicable)
    oldData: Object,        // Previous state (if applicable)
    newData: Object,        // New state (if applicable)
    reason: String,
    metadata: {
        channelId: String,
        category: String,
        assignedTo: String,
        tickets: [String],   // For bulk actions
        oldPriority: String,
        newPriority: String
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

module.exports = mongoose.model('TicketLog', ticketLogSchema); 