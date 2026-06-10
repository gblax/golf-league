import React from 'react';

// Small initials disc in the player's league color (see utils/playerColors).
// Decorative — the player's name is always rendered alongside it.
const PlayerAvatar = React.memo(function PlayerAvatar({ name, color, size = 'sm', className = '' }) {
  const initials = (name || '')
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
  const sizeClasses = size === 'xs' ? 'w-4 h-4 text-[8px]' : size === 'md' ? 'w-6 h-6 text-[10px]' : 'w-5 h-5 text-[9px]';

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 ${sizeClasses} ${className}`}
      style={{ backgroundColor: color || '#868d84' }}
    >
      {initials}
    </span>
  );
});

export default PlayerAvatar;
