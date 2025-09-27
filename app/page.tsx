'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [animationState, setAnimationState] = useState<'idle' | 'scrolling' | 'plane3d' | 'diving' | 'transformed'>('idle');
  const [scrollProgress, setScrollProgress] = useState(0);
  const router = useRouter();
  
  const handleTakeMeClick = () => {
    setAnimationState('scrolling');
    
    // Smooth scroll animation with page scroll
    const scrollDuration = 2250; 
    const startTime = Date.now();
    
    const scrollAnimation = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / scrollDuration, 1);
      
      setScrollProgress(progress);
      
      // Scroll the page to match the gradient expansion with smooth easing
      const scrollAmount = progress * window.innerHeight;
      
      // Use requestAnimationFrame for smoother scrolling
      const smoothScroll = () => {
        const currentScroll = window.pageYOffset;
        const targetScroll = scrollAmount;
        const diff = targetScroll - currentScroll;
        
        if (Math.abs(diff) > 0.5) {
          window.scrollTo(0, currentScroll + diff * 0.1);
          requestAnimationFrame(smoothScroll);
        } else {
          window.scrollTo(0, targetScroll);
        }
      };
      
      requestAnimationFrame(smoothScroll);
      
      if (progress < 1) {
        requestAnimationFrame(scrollAnimation);
      } else {
        // Show 3D plane after scroll completes (fade in quickly)
        setTimeout(() => setAnimationState('plane3d'), 200);
        // Start diving animation and navigate immediately
        setTimeout(() => {
          setAnimationState('diving');
          // Navigate to node.tsx immediately after diving starts
          setTimeout(() => router.push('../nodes'), 1000);
        }, 1000);
      }
    };
    
    requestAnimationFrame(scrollAnimation);
  };

  return (
    <div className="min-h-screen p-20 relative">
      <div className="max-w-[600px]">
        <h1 className="text-[9rem] leading-none m-0">Habitat</h1>
        <p className="text-xl mt-4 ml-2">
          It's a place where curiosity is nurtured,
          <br />
          where you can explore new ideas, and
          <br />
          rediscover the joy of discovery.
        </p>
        <button 
          onClick={handleTakeMeClick}
          className="hover:bg-[#1e00ff] hover:text-[#fff0d2] transition ml-2 mt-16 p-4 border-[#1e00ff] border-[1.5px] w-[60%] text-lg font-medium"
        >
          Take Me
        </button>
        
        {/* Animated Gradient Line - only visible during scroll */}
        <div 
          className="w-2 mt-0 ml-[20%] relative z-[100]"
          style={{
            height: animationState === 'idle' ? '0px' : `${scrollProgress * 100}vh`,
            background: animationState === 'idle' ? 'transparent' : 'linear-gradient(to bottom, #fff0d2, #1e00ff, #1e00ff)',
            opacity: (animationState === 'idle' || animationState === 'plane3d' || animationState === 'diving') ? 0 : 1,
            transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        ></div>
        
        {/* Spacer to create scrollable content */}
        <div 
          style={{
            height: animationState === 'idle' ? '0px' : `${scrollProgress * 100}vh`,
            transition: 'none' // No transition for spacer - it follows the scroll directly
          }}
        ></div>
      </div>

      {/* 3D Plane at bottom of gradient */}
      {animationState === 'plane3d' || animationState === 'diving' ? (
        <div 
          className={`fixed inset-0 transition-all duration-1000 ${
            animationState === 'plane3d' ? 'opacity-100 scale-100' : 
            'opacity-100'
          }`}
          style={{
            perspective: '1000px',
            transformStyle: 'preserve-3d',
            zIndex: 40
          }}
        >
            <div 
              className={`bg-[#fff0d2] w-screen h-screen transition-all duration-1000`}
              style={{
                background: 'linear-gradient(145deg, #fff0d2 0%, #f5e6c8 50%, #ebd9b8 100%)',
                transform: animationState === 'plane3d' ? 'rotateX(80deg) translateZ(50px) translateY(2rem)' : 'rotateX(0deg) translateZ(0px) scale(1.5)',
                transformOrigin: 'center center'
              }}
            >
            {/* Plate texture */}
            <div 
              className="absolute inset-0 rounded-lg opacity-30"
              style={{
                background: `
                  radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 50%),
                  linear-gradient(45deg, transparent 30%, rgba(0,0,0,0.05) 50%, transparent 70%)
                `
              }}
            ></div>
            
            {/* Plate border */}
            <div className="absolute inset-0 rounded-lg border-4 border-[#1e00ff]"></div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
