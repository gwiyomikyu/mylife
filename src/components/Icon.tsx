// シンプルな線画アイコン（stroke 1.6）
const P: Record<string, string> = {
  home: 'M3.5 10.5 12 4l8.5 6.5M5.5 9v10.5h13V9',
  habits: 'M9 6.5h11M9 12h11M9 17.5h11M4 6.5l1 1 2-2M4 12l1 1 2-2M4 17.5l1 1 2-2',
  money: 'M3.5 7h17v11h-17zM3.5 10.5h17M7 14.5h3',
  body: 'M12 21s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7.5 2.8C19.5 16.4 12 21 12 21z',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.1-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2.1 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.1 1.2L10 21h4l.5-2.6a7 7 0 0 0 2.1-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevL: 'M14.5 6 8.5 12l6 6',
  chevR: 'M9.5 6l6 6-6 6',
  close: 'M6 6l12 12M18 6 6 18',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13',
  leaf: 'M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7',
  moon: 'M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z',
  run: 'M13 4.5a1.5 1.5 0 1 0 0 .01M8 21l3-6 3 2v4M6 11l3-3h4l2 3 3 1M11 15l1-5',
  scale: 'M4.5 5h15v14h-15zM9 9.5a3 3 0 0 1 6 0M12 9.5l1-1.5',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14',
  upload: 'M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14',
  calendar: 'M4.5 6h15v14h-15zM4.5 10h15M8.5 3.5v4M15.5 3.5v4',
  spark: 'M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M6.5 17.5 9 15M15 9l2.5-2.5',
  wallet: 'M4 7.5h14.5v12H4zM4 7.5 15 4.5v3M15 13.5h.01',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  tasks: 'M5 4.5h14v15H5zM8.5 9.5l1.5 1.5 3-3M8.5 15h7',
  gift: 'M4.5 10.5h15v9h-15zM3.5 7.5h17v3h-17zM12 7.5v12M12 7.5C10.5 4.5 7 4.5 7 6.3S10 7.5 12 7.5zm0 0c1.5-3 5-3 5-1.2S14 7.5 12 7.5z',
  reflect: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM15.5 8.5l-2 5-5 2 2-5z',
  grip: 'M5 9h14M5 15h14',
  flame: 'M12 21c-3.5 0-6-2.4-6-5.6 0-3.6 3-5.4 3.5-8.9 2.3 1.4 3.3 3.4 3.3 5.2 1-.6 1.6-1.6 1.8-2.7 1.7 1.5 3.4 3.7 3.4 6.4 0 3.2-2.5 5.6-6 5.6z',
}

export function Icon({ name, size = 22, className = '', strokeWidth = 1.6 }: { name: keyof typeof P | string; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={P[name] ?? ''} />
    </svg>
  )
}
