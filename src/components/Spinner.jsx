import React from 'react';

// Shared loading spinner. Pass the border color via className — e.g.
// 'border-emerald-600 dark:border-emerald-400' standalone, or 'border-current'
// inside buttons so it follows the text color (including disabled states).
// Decorative: every usage sits next to visible loading text, so it's hidden
// from screen readers rather than double-announcing.
const SIZES = {
  sm: 'w-4 h-4 border-2',
  md: 'w-5 h-5 border-2',
  lg: 'w-8 h-8 border-[3px]',
  xl: 'w-10 h-10 border-[3px]',
};

const Spinner = React.memo(function Spinner({
  size = 'lg',
  className = 'border-emerald-600 dark:border-emerald-400',
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block ${SIZES[size] || SIZES.lg} ${className} border-t-transparent rounded-full animate-spin`}
    />
  );
});

export default Spinner;
