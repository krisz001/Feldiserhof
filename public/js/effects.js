// Scroll-reveal (Animate.css v3)
(() => {
  const els = document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window) || !els.length) return;

  const io = new IntersectionObserver((entries, obs)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.classList.add('animated','fadeInUp');
        e.target.style.setProperty('--animate-duration', '700ms');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: .15 });

  els.forEach(el=>{
    el.style.opacity = 0;
    io.observe(el);
  });
})();
