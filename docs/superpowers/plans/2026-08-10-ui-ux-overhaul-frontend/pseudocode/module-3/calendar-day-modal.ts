// ---- components/module-3/3.2-calendar/DayPostsModal.tsx ----
imports: DayModalSlotProps from './calendarTypes', Modal from '../../shared/Modal'

// The shell (M3-F2) owns modalDate and the "no posts → no-op" gate, so this component is
// only ever mounted with a non-empty posts array.

function DayPostsModal({ date, posts, onClose }: DayModalSlotProps):
  render: <Modal open title={formatted date} onClose={onClose}> listing every post that day —
    caption, platform, status chip; published posts additionally show reach / likes /
    engagementRate inline; draft posts show a "Draft" chip and no metrics
