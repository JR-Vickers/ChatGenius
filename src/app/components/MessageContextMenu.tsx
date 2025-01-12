'use client';

interface MessageContextMenuProps {
  x: number;
  y: number;
  onReplyInThread: () => void;
  onClose: () => void;
}

export default function MessageContextMenu({ x, y, onReplyInThread, onClose }: MessageContextMenuProps) {
  return (
    <div 
      className="fixed bg-black border border-green-800/50 py-1"
      style={{ top: y, left: x }}
      onMouseLeave={onClose}
    >
      <button 
        onClick={() => {
          onReplyInThread();
          onClose();
        }}
        className="w-full px-4 py-1 text-left text-gray-200 hover:bg-green-900/30"
      >
        Reply in thread
      </button>
    </div>
  );
}
