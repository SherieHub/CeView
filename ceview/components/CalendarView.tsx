import React, { useMemo } from 'react';
import { MOCK_CALENDAR_EVENTS, MOCK_NOTIFICATIONS, MOCK_PERFORMANCE_REPORTS, COLORS } from '../constants';
import { ChevronLeft, ChevronRight, MapPin, Bell, Send, Calendar } from 'lucide-react';
import { CalendarEvent } from '../types';

const CalendarView: React.FC = () => {
  
  // Merge all data sources into calendar events
  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = [...MOCK_CALENDAR_EVENTS];

    // 1. Add Trends (Notifications)
    MOCK_NOTIFICATIONS.forEach(notif => {
      // Parse "Week of May 19, 2025" -> Date Object -> ISO String
      try {
        const dateStr = notif.date.replace('Week of ', '');
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
             // Adjust to YYYY-MM-DD local time manually to avoid timezone shifts for mock data
             const year = date.getFullYear();
             const month = String(date.getMonth() + 1).padStart(2, '0');
             const day = String(date.getDate()).padStart(2, '0');
             const isoDate = `${year}-${month}-${day}`;

             events.push({
                id: `trend-${notif.id}`,
                title: `Trend: ${notif.trend}`,
                date: isoDate,
                type: 'trend',
                market: notif.market
             });
        }
      } catch (e) {
        console.warn("Date parse error", e);
      }
    });

    // 2. Add Posts (Performance Reports)
    MOCK_PERFORMANCE_REPORTS.forEach(report => {
      report.data.forEach(post => {
        events.push({
          id: `post-${post.id}`,
          title: `Posted: ${post.platform}`,
          date: post.date,
          type: 'post',
          market: 'Global' // Default for posts
        });
      });
    });

    return events;
  }, []);

  return (
    <div className="animate-fade-in space-y-6">
       <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Experience Calendar</h2>
          <p className="text-slate-500 mt-1">Timeline of Market Trends, Micro-seasons, and Your Content Actions.</p>
        </div>
        <div className="flex gap-2">
           <button className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={20} /></button>
           <span className="text-lg font-semibold text-slate-700 px-2">May 2025</span>
           <button className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight size={20} /></button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-6 text-sm">
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#D6A539]"></div>
            <span className="text-slate-600">Peak Season</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border border-[#007892]" style={{ backgroundColor: '#E0F7FA' }}></div>
            <span className="text-slate-600">Trend Signal (Home)</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#506E53]"></div>
            <span className="text-slate-600">Content Posted</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Week Header */}
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-4 text-center text-sm font-semibold text-slate-400">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid - May 2025 */}
        {/* May 1, 2025 is a Thursday. 
            Row 1: Sun(27), Mon(28), Tue(29), Wed(30), Thu(1) ... 
            To align index 4 to Day 1, dayNum = index - 3. 
        */}
        <div className="grid grid-cols-7 h-[800px]">
           {Array.from({ length: 42 }).map((_, i) => {
             const dayNum = i - 3; 
             const isValidDay = dayNum > 0 && dayNum <= 31;
             
             // Simple formatted date string for matching YYYY-MM-DD
             const dateStr = isValidDay ? `2025-05-${String(dayNum).padStart(2, '0')}` : '';

             // Find all events for this day
             const daysEvents = isValidDay 
                ? allEvents.filter(e => e.date === dateStr)
                : [];

             return (
               <div key={i} className={`border-r border-b border-slate-100 p-2 relative flex flex-col gap-1 overflow-y-auto ${!isValidDay ? 'bg-slate-50/50' : ''}`}>
                 {isValidDay && (
                   <span className="text-sm font-medium text-slate-500 sticky top-0">{dayNum}</span>
                 )}
                 
                 {daysEvents.map((event) => {
                   // Style Logic
                   let bg = COLORS.CYAN + '30';
                   let color = COLORS.TEAL;
                   let border = COLORS.TEAL;
                   let Icon = Calendar;

                   if (event.type === 'peak') {
                        bg = COLORS.GOLD;
                        color = '#fff';
                        border = '#B8860B';
                        Icon = MapPin;
                   } else if (event.type === 'trend') {
                        bg = '#E0F7FA'; // Light Cyan
                        color = '#007892'; // Teal
                        border = '#007892';
                        Icon = Bell;
                   } else if (event.type === 'post') {
                        bg = '#F0FDF4'; // Light Green
                        color = '#15803d'; // Green 700
                        border = '#506E53';
                        Icon = Send;
                   }

                   return (
                    <div 
                        key={event.id}
                        className="p-1.5 rounded-md text-[10px] font-medium cursor-pointer transition-transform hover:scale-105 shadow-sm border-l-2"
                        style={{ 
                            backgroundColor: bg,
                            color: color,
                            borderLeftColor: border
                        }}
                        title={event.title}
                    >
                        <div className="flex items-center gap-1 mb-0.5">
                            <Icon size={10} />
                            <span className="opacity-75">{event.type === 'trend' ? 'Signal' : event.type === 'post' ? 'Action' : event.market}</span>
                        </div>
                        <p className="truncate font-bold leading-tight">{event.title.replace('Trend: ', '').replace('Posted: ', '')}</p>
                    </div>
                   );
                 })}
               </div>
             );
           })}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;