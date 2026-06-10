import React from 'react';

// Shared empty-state panel: icon + title + optional caption in a tinted box,
// following the pattern established by the commissioner tab's
// "select a tournament" state.
const EmptyState = React.memo(function EmptyState({ icon: Icon, title, caption, className = '' }) {
  return (
    <div className={`text-center py-10 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl ${className}`}>
      {Icon && <Icon className="text-slate-300 dark:text-slate-600 mx-auto mb-3" size={32} aria-hidden="true" />}
      {title && <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>}
      {caption && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{caption}</p>}
    </div>
  );
});

export default EmptyState;
