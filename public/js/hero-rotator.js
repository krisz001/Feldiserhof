(() => {
  const container = document.querySelector('[data-hero]');
  if (!container) return;

  let config = {
    images: [],
    interval: 7000,
    fadeDuration: 1600,
    kenburnsEffects: ['zoom', 'pan-left', 'pan-right'],
    enableParallax: true,
    enableAutoPlay: true,
    enableNavigation: true,
    enableProgress: true
  };

  try {
    const rawConfig = container.getAttribute('data-hero-config');
    if (rawConfig) {
      const userConfig = JSON.parse(rawConfig);
      config = { ...config, ...userConfig };
    }
  } catch (error) {
    console.error('Error parsing hero config:', error);
    config.images = [
      '/img/hero/feldiserhof-winter.jpg',
      '/img/hero/feldiserhof-sunset.jpg', 
      '/img/hero/feldiserhof-view.jpg',
      '/img/hero/miratoedi.jpg',
      '/img/her/IMG_0365 2'
    ];
  }

  const slidesWrap = container.querySelector('.hero-slides');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const existingProgress = container.querySelector('.hero-progress');
  const existingNav = container.querySelector('.hero-nav');

  const preloadImages = () => {
    config.images.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  };

  const createSlides = () => {
    return config.images.map((src, idx) => {
      const el = document.createElement('div');
      const effect = config.kenburnsEffects[idx % config.kenburnsEffects.length];
      el.className = `hero-slide kenburns-${effect} ${idx === 0 ? 'is-active' : ''}`;
      el.style.backgroundImage = `url("${src}")`;
      el.setAttribute('data-slide-index', idx);
      slidesWrap.appendChild(el);
      return el;
    });
  };

  const createProgress = () => {
    if (!config.enableProgress || config.images.length < 2 || existingProgress) return null;
    const progress = document.createElement('div');
    progress.className = 'hero-progress';
    config.images.forEach((_, idx) => {
      const item = document.createElement('div');
      item.className = `hero-progress-item ${idx === 0 ? 'active' : ''}`;
      item.setAttribute('data-progress-index', idx);
      const fill = document.createElement('div');
      fill.className = 'progress-fill';
      item.appendChild(fill);
      item.addEventListener('click', () => goToSlide(idx));
      progress.appendChild(item);
    });
    container.appendChild(progress);
    return progress;
  };

  const createNavigation = () => {
    if (!config.enableNavigation || config.images.length < 2 || existingNav) return null;
    const nav = document.createElement('div');
    nav.className = 'hero-nav';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'hero-nav-button hero-nav-prev';
    prevBtn.innerHTML = '‹';
    prevBtn.setAttribute('aria-label', 'Previous image');
    prevBtn.addEventListener('click', prevSlide);
    const nextBtn = document.createElement('button');
    nextBtn.className = 'hero-nav-button hero-nav-next';
    nextBtn.innerHTML = '›';
    nextBtn.setAttribute('aria-label', 'Next image');
    nextBtn.addEventListener('click', nextSlide);
    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    container.appendChild(nav);
    return { prev: prevBtn, next: nextBtn };
  };

  let current = 0;
  let timer = null;
  let isAnimating = false;
  let slides = [];
  let progressItems = [];
  let navigation = null;

  const showSlide = async (next) => {
    if (next === current || isAnimating || config.images.length < 2) return;
    isAnimating = true;
    if (progressItems && progressItems.length > 0) {
      progressItems.forEach(item => {
        item.classList.remove('active', 'paused');
        const fill = item.querySelector('.progress-fill');
        if (fill) {
          fill.style.width = '0%';
          fill.style.animation = 'none';
        }
      });
    }
    slides[current].classList.remove('is-active');
    slides[next].classList.add('is-active');
    const content = container.querySelector('.hero-content');
    if (content && !prefersReduced) {
      content.style.opacity = '0.9';
      setTimeout(() => {
        content.style.opacity = '1';
      }, 50);
    }
    if (progressItems && progressItems[next]) {
      const fill = progressItems[next].querySelector('.progress-fill');
      if (fill) {
        progressItems[next].classList.add('active');
        fill.style.animation = `progressCountdown ${config.interval}ms linear forwards`;
      }
    }
    current = next;
    await new Promise(resolve => setTimeout(resolve, config.fadeDuration));
    isAnimating = false;
  };

  const nextSlide = () => {
    const next = (current + 1) % config.images.length;
    showSlide(next);
    resetTimer();
  };

  const prevSlide = () => {
    const prev = (current - 1 + config.images.length) % config.images.length;
    showSlide(prev);
    resetTimer();
  };

  const goToSlide = (index) => {
    if (index >= 0 && index < config.images.length) {
      showSlide(index);
      resetTimer();
    }
  };

  // Folyamatos slideshow – csak akkor álljon le, ha explicit tabváltás van
  const startTimer = () => {
    if (prefersReduced || !config.enableAutoPlay || config.images.length < 2) return;
    stopTimer();
    timer = setInterval(nextSlide, config.interval);
  };

  const stopTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (progressItems && progressItems[current]) {
      progressItems[current].classList.add('paused');
      const fill = progressItems[current].querySelector('.progress-fill');
      if (fill) {
        fill.style.animationPlayState = 'paused';
      }
    }
  };

  const resetTimer = () => {
    stopTimer();
    startTimer();
  };

  const initParallax = () => {
    if (prefersReduced || !config.enableParallax) return;
    const content = container.querySelector('.hero-content');
    if (!content) return;
    let ticking = false;
    const updateParallax = () => {
      const rect = container.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const scrolled = window.pageYOffset;
      const rate = scrolled * -config.parallaxIntensity;
      slidesWrap.style.transform = `translateY(${rate}px) translateZ(0)`;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  };

  const attachEventListeners = () => {
    if (existingProgress) {
      progressItems = Array.from(existingProgress.querySelectorAll('.hero-progress-item'));
      progressItems.forEach((item, index) => {
        item.addEventListener('click', () => goToSlide(index));
      });
    }
    if (existingNav) {
      const prevBtn = existingNav.querySelector('.hero-nav-prev');
      const nextBtn = existingNav.querySelector('.hero-nav-next');
      if (prevBtn) prevBtn.addEventListener('click', prevSlide);
      if (nextBtn) nextBtn.addEventListener('click', nextSlide);
      navigation = { prev: prevBtn, next: nextBtn };
    }
  };

  const init = () => {
    preloadImages();
    slides = createSlides();
    if (config.enableProgress) {
      const progress = createProgress();
      if (progress) {
        progressItems = Array.from(progress.querySelectorAll('.hero-progress-item'));
      } else if (existingProgress) {
        progressItems = Array.from(existingProgress.querySelectorAll('.hero-progress-item'));
      }
    }
    if (config.enableNavigation) {
      navigation = createNavigation();
    }
    attachEventListeners();
    initParallax();
    startTimer();

    // Automatically restart slideshow on tab/window focus
    window.addEventListener('focus', startTimer);

    // Visibilitychange csak leállítja a slideshow-t tabváltáskor, indítás csak fókuszban
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopTimer();
      }
      // Fókusz esemény indítja újra!
    });

    // -- NINCS több pause on hover/touch --
    // Ha szeretnél szünetet, visszaállítható, de a végtelen váltáshoz hagyd ki:

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch(e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          prevSlide();
          break;
        case 'ArrowRight':
          e.preventDefault();
          nextSlide();
          break;
        case ' ':
          e.preventDefault();
          if (timer) stopTimer(); else startTimer();
          break;
      }
    });

    const heroBadge = container.querySelector('.hero-badge');
    if (heroBadge && !prefersReduced) {
      heroBadge.addEventListener('mouseenter', () => {
        heroBadge.classList.add('hover-active');
      });
      heroBadge.addEventListener('mouseleave', () => {
        heroBadge.classList.remove('hover-active');
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
