import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface DraggableSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  maxHeight?: string;
}

export const DraggableSheet: React.FC<DraggableSheetProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  maxHeight = 'max-h-[85vh]'
}) => {
  const [translateY, setTranslateY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const startYRef = useRef<number>(0);
  const currentYRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setTranslateY(0);
      onClose();
    }, 200);
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Reset states when opened
  useEffect(() => {
    if (isOpen) {
      setTranslateY(0);
      setIsDragging(false);
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow drag if we touch header/handle or if the scrollable content is at the very top (scrollTop === 0)
    const scrollTop = scrollableRef.current?.scrollTop ?? 0;
    if (scrollTop > 0 && e.target !== sheetRef.current) {
      return;
    }

    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    startTimeRef.current = Date.now();
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    currentYRef.current = currentY;
    const deltaY = currentY - startYRef.current;

    const scrollTop = scrollableRef.current?.scrollTop ?? 0;
    if (scrollTop > 0 && deltaY > 0) {
      // Allow standard scrolling inside content
      return;
    }

    if (deltaY > 0) {
      // Dragging down: move 1:1
      setTranslateY(deltaY);
    } else {
      // Dragging up: apply rubber band resistance
      setTranslateY(deltaY * 0.25);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const deltaY = currentYRef.current - startYRef.current;
    const deltaTime = Math.max(1, Date.now() - startTimeRef.current);
    const velocityY = deltaY / deltaTime;

    // If dragged down > 80px or flicked downwards quickly (> 0.35 px/ms)
    if (deltaY > 80 || (deltaY > 30 && velocityY > 0.35)) {
      handleClose();
    } else {
      // Snap back to 0
      setTranslateY(0);
    }
  };

  // Mouse drag support for desktop/testing
  const handleMouseDown = (e: React.MouseEvent) => {
    startYRef.current = e.clientY;
    currentYRef.current = e.clientY;
    startTimeRef.current = Date.now();
    setIsDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startYRef.current;
      currentYRef.current = moveEvent.clientY;
      if (deltaY > 0) {
        setTranslateY(deltaY);
      } else {
        setTranslateY(deltaY * 0.2);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDragging(false);

      const deltaY = currentYRef.current - startYRef.current;
      const deltaTime = Math.max(1, Date.now() - startTimeRef.current);
      const velocityY = deltaY / deltaTime;

      if (deltaY > 80 || (deltaY > 30 && velocityY > 0.35)) {
        handleClose();
      } else {
        setTranslateY(0);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  if (!isOpen && !isClosing) return null;

  const backdropOpacity = Math.max(0, 1 - translateY / 250);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-200"
      style={{ opacity: isClosing ? 0 : backdropOpacity }}
      onClick={handleClose}
    >
      <div
        ref={sheetRef}
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`w-full max-w-md bg-[#111827] border-t border-slate-700/80 rounded-t-3xl shadow-2xl flex flex-col ${maxHeight} select-none ${
          isDragging ? 'transition-none' : 'transition-transform duration-200 ease-out'
        }`}
        style={{
          transform: isClosing ? 'translateY(100%)' : `translateY(${Math.max(0, translateY)}px)`
        }}
      >
        {/* Grab Pill Handle for Dragging Up/Down */}
        <div
          onMouseDown={handleMouseDown}
          className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none shrink-0"
        >
          <div className="w-14 h-1.5 bg-slate-600/80 rounded-full active:bg-cyan-400 transition-colors" />
          <span className="text-[9px] text-slate-500 font-mono tracking-wider uppercase mt-1">
            Swipe down to close
          </span>
        </div>

        {/* Optional Header */}
        {(title || icon) && (
          <div className="px-5 pb-3 flex items-center justify-between gap-3 border-b border-slate-800/80 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {icon}
              {typeof title === 'string' ? (
                <h3 className="text-base font-bold text-white truncate">{title}</h3>
              ) : (
                title
              )}
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable Content Container */}
        <div
          ref={scrollableRef}
          className="p-5 overflow-y-auto space-y-4 flex-1 overscroll-contain"
        >
          {children}
        </div>
      </div>
    </div>
  );
};
