import { Injectable } from '@nestjs/common';

@Injectable()
export class TimeCounterService {
    private readonly PROTEST_START_DATE = new Date('2025-09-08T00:00:00Z');

    /**
     * Calculate time elapsed since September 8, 2025
     * @returns Formatted string like "5 days, 1 hour, 1 minute"
     */
    getTimeSinceProtest(): string {
        const now = new Date();
        const diffMs = now.getTime() - this.PROTEST_START_DATE.getTime();

        if (diffMs < 0) {
            return 'Protest has not started yet';
        }

        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
            (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        const parts = [];

        if (days > 0) {
            parts.push(`${days} day${days !== 1 ? 's' : ''}`);
        }

        if (hours > 0) {
            parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
        }

        if (minutes > 0) {
            parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
        }

        if (parts.length === 0) {
            return 'Just started';
        }

        return parts.join(', ');
    }

    /**
     * Get a formatted message about waiting for justice
     * @returns String like "⏰ Waiting for justice since 5 days, 1 hour, 1 minute"
     */
    getJusticeWaitMessage(): string {
        const timeElapsed = this.getTimeSinceProtest();
        return `⏰ Waiting for justice since ${timeElapsed}`;
    }

    /**
     * Get a more dramatic version of the justice message
     * @returns String like "🔥 5 days, 1 hour, 1 minute of waiting for justice. How much longer?"
     */
    getDramaticJusticeMessage(): string {
        const timeElapsed = this.getTimeSinceProtest();
        return `🔥 ${timeElapsed} of waiting for justice. How much longer?`;
    }

    /**
     * Get a hashtag-friendly version
     * @returns String like "#JusticeForGenZ #5DaysWaiting #NoMoreDelays"
     */
    getJusticeHashtags(): string {
        const now = new Date();
        const diffMs = now.getTime() - this.PROTEST_START_DATE.getTime();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        const hashtags = ['#JusticeForGenZ', '#GenZProtestSeptember8'];

        if (days > 0) {
            hashtags.push(`#${days}DaysWaiting`);
        }

        hashtags.push('#NoMoreDelays', '#PunishTheCulprit');

        return hashtags.join(' ');
    }
}
