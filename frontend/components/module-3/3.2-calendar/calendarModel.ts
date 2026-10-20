/**
 * The Calendar's view of the shared post list: each post placed on the day it
 * goes out (a scheduled post on its scheduled day, at its scheduled time), and
 * the weeks a month grid needs.
 */
import type { PublishedPost } from '../../../types';
import { parseLocal } from '../3.1-content-studio/schedule';

export type CalStatus = PublishedPost['status'];

export interface CalEntry {
  post: PublishedPost;
  /** yyyy-mm-dd, local. */
  day: string;
  /** "9:00 AM" for a scheduled post; published posts carry no time. */
  time: string | null;
  /** Minutes past midnight, for ordering within a day (unknown sorts first). */
  minutes: number;
  /** The caption's first line — what the post is called on the calendar. */
  title: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayFromIso(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function titleOf(caption: string): string {
  const first = caption.trim().split('\n').find((line) => line.trim()) ?? '';
  return first.trim() || 'Untitled post';
}

export function toEntry(post: PublishedPost): CalEntry {
  const at = post.scheduledFor ? parseLocal(post.scheduledFor) : null;
  return {
    post,
    day: at ? isoDay(at) : post.date.slice(0, 10),
    time: at ? at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null,
    minutes: at ? at.getHours() * 60 + at.getMinutes() : -1,
    title: titleOf(post.caption),
  };
}

export function byWhen(a: CalEntry, b: CalEntry): number {
  return a.day.localeCompare(b.day) || a.minutes - b.minutes;
}

/** Still to go out: scheduled, and not already past. */
export function isUpcoming(entry: CalEntry, now: Date): boolean {
  if (entry.post.status !== 'scheduled') return false;
  const at = entry.post.scheduledFor ? parseLocal(entry.post.scheduledFor) : null;
  return at ? at.getTime() >= now.getTime() : entry.day >= isoDay(now);
}

export interface GridDay {
  day: string;
  date: number;
  inMonth: boolean;
}

/** Whole weeks (Sunday first) covering the month — five or six, never padded to six. */
export function monthWeeks(year: number, month: number): GridDay[][] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const daysIn = new Date(year, month + 1, 0).getDate();
  const count = Math.ceil((first.getDay() + daysIn) / 7) * 7;
  const weeks: GridDay[][] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({ day: isoDay(d), date: d.getDate(), inMonth: d.getMonth() === month });
  }
  return weeks;
}
