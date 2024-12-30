const Warning = require('../models/Warning');

/**
 * Service class for handling warning-related operations
 */
class WarningService {
    /**
     * Create a new warning
     * @param {Object} data - Warning data
     * @returns {Promise<Warning>} Created warning
     */
    async createWarning(data) {
        try {
            const warning = new Warning(data);
            await warning.save();
            return warning;
        } catch (error) {
            console.error('Error creating warning:', error);
            throw error;
        }
    }

    /**
     * Get warnings for a specific user in a guild
     * @param {String} userId - User ID
     * @param {String} guildId - Guild ID
     * @param {Boolean} activeOnly - Whether to fetch only active warnings
     * @returns {Promise<Array>} Array of warnings
     */
    async getUserWarnings(userId, guildId, activeOnly = true) {
        try {
            const query = {
                userId,
                guildId,
                ...(activeOnly && { active: true }),
                ...(activeOnly && { 
                    $or: [
                        { expiresAt: { $gt: new Date() } },
                        { expiresAt: null }
                    ]
                })
            };

            return await Warning.find(query)
                .sort({ createdAt: -1 })
                .lean();
        } catch (error) {
            console.error('Error fetching user warnings:', error);
            throw error;
        }
    }

    /**
     * Calculate total warning points for a user
     * @param {String} userId - User ID
     * @param {String} guildId - Guild ID
     * @returns {Promise<Number>} Total warning points
     */
    async calculateUserPoints(userId, guildId) {
        try {
            const activeWarnings = await this.getUserWarnings(userId, guildId);
            return activeWarnings.reduce((total, warning) => total + warning.points, 0);
        } catch (error) {
            console.error('Error calculating user points:', error);
            throw error;
        }
    }

    /**
     * Get statistics about warnings in a guild
     * @param {String} guildId - Guild ID
     * @param {Number} days - Number of days to look back
     * @returns {Promise<Array>} Warning statistics
     */
    async getGuildStats(guildId, days = 30) {
        try {
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - days);

            const stats = await Warning.aggregate([
                {
                    $match: {
                        guildId,
                        createdAt: { $gte: dateLimit }
                    }
                },
                {
                    $group: {
                        _id: {
                            level: '$level',
                            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { '_id.day': -1 }
                }
            ]);

            return stats;
        } catch (error) {
            console.error('Error getting guild stats:', error);
            throw error;
        }
    }

    async getMostWarnedUsers(guildId, limit = 10) {
        try {
            return await Warning.aggregate([
                {
                    $match: {
                        guildId,
                        active: true
                    }
                },
                {
                    $group: {
                        _id: '$userId',
                        totalWarnings: { $sum: 1 },
                        totalPoints: { $sum: '$points' },
                        warnings: {
                            $push: {
                                reason: '$reason',
                                level: '$level',
                                createdAt: '$createdAt'
                            }
                        }
                    }
                },
                {
                    $sort: { totalPoints: -1 }
                },
                {
                    $limit: limit
                }
            ]);
        } catch (error) {
            console.error('Error getting most warned users:', error);
            throw error;
        }
    }
}

module.exports = new WarningService(); 