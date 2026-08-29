import { NoticeCategory } from '@informes/shared';
import { CATEGORY_LABELS } from '@/lib/labels';

const STYLES: Record<NoticeCategory, string> = {
  [NoticeCategory.PROPERTY_AUCTION]: 'bg-emerald-100 text-emerald-700',
  [NoticeCategory.VEHICLE_AUCTION]: 'bg-amber-100 text-amber-700',
  [NoticeCategory.DECEASED]: 'bg-slate-200 text-slate-700',
  [NoticeCategory.DISSOLVED_COMPANY]: 'bg-violet-100 text-violet-700',
};

export function CategoryBadge({ category }: { category: NoticeCategory }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        STYLES[category],
      ].join(' ')}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}
