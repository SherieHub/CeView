import { describe, expect, it } from 'vitest';
import { formatSchedule, isFuture, parseLocal } from './schedule';
import { toEntry, isoDay } from '../3.2-calendar/calendarModel';
import type { PublishedPost } from '../../../types';

describe('persisted scheduling timestamps', () => {
  it('reads both datetime-local drafts and offset timestamps returned by the API', () => {
    expect(parseLocal('2099-01-02T09:30')?.getHours()).toBe(9);
    expect(parseLocal('2099-01-01T16:30:00Z')?.getTime()).toBe(Date.parse('2099-01-02T00:30:00+08:00'));
    expect(parseLocal('not a date')).toBeNull();
    expect(isFuture('2099-01-01T16:30:00Z', new Date('2099-01-01T16:00:00Z'))).toBe(true);
  });
  it('places a persisted schedule on its local calendar day with a formatted time', () => {
    const timestamp = '2099-01-01T16:30:00Z';
    const local = new Date(timestamp);
    const post = { id: 'scheduled', caption: 'A scheduled post', status: 'scheduled', date: '2099-01-01', scheduledFor: timestamp } as PublishedPost;
    const entry = toEntry(post);
    expect(entry.day).toBe(isoDay(local));
    expect(entry.minutes).toBe(local.getHours() * 60 + local.getMinutes());
    expect(entry.time).not.toBeNull();
    expect(formatSchedule(timestamp)).not.toBe(timestamp);
  });
});
