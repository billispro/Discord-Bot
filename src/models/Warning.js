const mongoose = require('mongoose');

/**
 * Warning Schema
 * Stores information about warnings issued to users
 */
const warningSchema = new mongoose.Schema({
    // User who received the warning
    userId: {
        type: String,
        required: true,
        index: true
    },
    // Server where the warning was issued
    guildId: {
        type: String,
        required: true,
        index: true
    },
    // Moderator who issued the warning
    moderatorId: {
        type: String,
        required: true
    },
    // Reason for the warning
    reason: {
        type: String,
        required: true
    },
    // Warning severity level
    level: {
        type: String,
        enum: ['MINOR', 'MODERATE', 'MAJOR'],
        required: true
    },
    // Warning points
    points: {
        type: Number,
        required: true
    },
    // Optional evidence (e.g., message links, screenshots)
    evidence: String,
    // Whether the warning is still active
    active: {
        type: Boolean,
        default: true
    },
    // Optional expiration date for temporary warnings
    expiresAt: {
        type: Date,
        index: true
    },
    // When the warning was issued
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Compound indexes for frequent queries
warningSchema.index({ userId: 1, guildId: 1, active: 1 });
warningSchema.index({ guildId: 1, createdAt: -1 });

module.exports = mongoose.model('Warning', warningSchema); 