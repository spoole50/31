import { useState, useEffect } from 'react';

const useScrollDirection = () => {
  const [scrollDirection, setScrollDirection] = useState('up');
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const updateScrollDirection = () => {
      const scrollY = window.pageYOffset;
      const direction = scrollY > lastScrollY ? 'down' : 'up';
      
      // Only update if we've scrolled more than 10px to avoid jitter
      if (Math.abs(scrollY - lastScrollY) > 10) {
        setScrollDirection(direction);
        setLastScrollY(scrollY);
      }
    };

    window.addEventListener('scroll', updateScrollDirection);
    
    return () => {
      window.removeEventListener('scroll', updateScrollDirection);
    };
  }, [lastScrollY]);

  return scrollDirection;
};

export default useScrollDirection;
