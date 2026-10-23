(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const body = document.body;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let motionPaused = reducedMotion.matches;
  let currentChoice = null;
  let toastTimer;

  // A lightweight procedural starfield keeps the opening alive without image assets.
  const canvas = $('#starfield');
  const ctx = canvas?.getContext('2d');
  let stars = [];
  let canvasWidth = 0, canvasHeight = 0, dpr = 1;
  function resizeStarfield() {
    if (!canvas || !ctx) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasWidth = canvas.clientWidth;
    canvasHeight = canvas.clientHeight;
    canvas.width = Math.floor(canvasWidth * dpr);
    canvas.height = Math.floor(canvasHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(230, Math.floor(canvasWidth * canvasHeight / 6500));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * canvasWidth,
      y: Math.random() * canvasHeight,
      r: Math.random() * 1.25 + .15,
      a: Math.random() * .65 + .15,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * .018 + .003,
      drift: (Math.random() - .5) * .08
    }));
  }
  let frame = 0;
  function drawStars() {
    if (!ctx || motionPaused) return;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    for (const star of stars) {
      star.phase += star.speed;
      star.y += star.drift;
      if (star.y > canvasHeight) star.y = 0;
      if (star.y < 0) star.y = canvasHeight;
      const alpha = star.a * (.66 + Math.sin(star.phase) * .34);
      ctx.beginPath();
      ctx.fillStyle = `rgba(225, 222, 255, ${alpha})`;
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    frame = requestAnimationFrame(drawStars);
  }
  function restartStarfield() {
    cancelAnimationFrame(frame);
    if (!motionPaused) frame = requestAnimationFrame(drawStars);
  }
  resizeStarfield();
  restartStarfield();
  window.addEventListener('resize', resizeStarfield, { passive: true });

  // Reveal sections only as they enter view; use a fallback for older browsers.
  const revealItems = $$('.reveal');
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: .12, rootMargin: '0px 0px -35px 0px' });
    revealItems.forEach(el => revealObserver.observe(el));
  } else revealItems.forEach(el => el.classList.add('in-view'));
  // Hero should never start blank if script loads after the first paint.
  setTimeout(() => $$('.hero .reveal').forEach(el => el.classList.add('in-view')), 120);

  const progress = $('#reading-progress');
  const backTop = $('#back-top');
  const chapterStatus = $('#chapter-status');
  const scenes = $$('.scene[data-chapter]');
  let ticking = false;
  function updateScrollUI() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const percent = scrollable > 0 ? Math.min(100, Math.max(0, window.scrollY / scrollable * 100)) : 0;
    progress.style.width = `${percent}%`;
    backTop.classList.toggle('visible', window.scrollY > 600);
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(updateScrollUI); ticking = true; }
  }, { passive: true });
  updateScrollUI();
  if ('IntersectionObserver' in window) {
    const chapterObserver = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) chapterStatus.textContent = visible.target.dataset.chapter;
    }, { threshold: [0.15, .35, .6] });
    scenes.forEach(scene => chapterObserver.observe(scene));
  }
  backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: motionPaused ? 'auto' : 'smooth' }));

  // Chapter menu interactions.
  const menuToggle = $('#menu-toggle');
  const chapterMenu = $('#chapter-menu');
  function closeMenu() { menuToggle.setAttribute('aria-expanded', 'false'); chapterMenu.classList.remove('open'); }
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(open));
    chapterMenu.classList.toggle('open', open);
  });
  $$('a', chapterMenu).forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  document.addEventListener('click', e => {
    if (chapterMenu.classList.contains('open') && !chapterMenu.contains(e.target) && !menuToggle.contains(e.target)) closeMenu();
  });

  // Motion control respects the operating-system reduced-motion preference.
  const motionToggle = $('#motion-toggle');
  const motionLabel = $('#motion-label');
  function applyMotionState() {
    body.classList.toggle('motion-paused', motionPaused);
    body.classList.toggle('reduce-motion', motionPaused);
    motionToggle.setAttribute('aria-pressed', String(motionPaused));
    motionToggle.title = motionPaused ? 'Resume motion' : 'Pause motion';
    motionLabel.textContent = motionPaused ? 'MOTION OFF' : 'MOTION ON';
    restartStarfield();
  }
  motionToggle.addEventListener('click', () => {
    motionPaused = !motionPaused;
    applyMotionState();
    showToast(motionPaused ? 'Motion paused — take your time.' : 'The dream is moving again.');
  });
  applyMotionState();

  // Pointer glow and restrained 3D tilt are desktop-only to avoid mobile jank.
  const cursorGlow = $('.cursor-glow');
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion.matches) {
    window.addEventListener('pointermove', e => {
      cursorGlow.style.opacity = motionPaused ? '0' : '.8';
      cursorGlow.style.transform = `translate(${e.clientX - 130}px, ${e.clientY - 130}px)`;
      cursorGlow.style.left = '0'; cursorGlow.style.top = '0';
    }, { passive: true });
    window.addEventListener('pointerleave', () => cursorGlow.style.opacity = '0');
    $$('.memory-card, .choice-card').forEach(card => {
      card.addEventListener('pointermove', e => {
        if (motionPaused) return;
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        card.style.transform = `perspective(900px) rotateX(${-y * 5}deg) rotateY(${x * 5}deg) translateY(-4px)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  // Tiny sparks on deliberate clicks, bounded so they never become a performance problem.
  function burst(x, y, count = 9) {
    if (motionPaused || reducedMotion.matches) return;
    for (let i = 0; i < count; i++) {
      const spark = document.createElement('span');
      const angle = Math.PI * 2 * i / count + Math.random() * .25;
      const distance = 24 + Math.random() * 48;
      spark.className = 'spark';
      spark.style.left = `${x}px`; spark.style.top = `${y}px`;
      spark.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
      spark.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
      document.body.appendChild(spark);
      spark.addEventListener('animationend', () => spark.remove(), { once: true });
    }
  }
  document.addEventListener('click', e => {
    const target = e.target.closest('button, .round-link');
    if (!target || motionPaused || reducedMotion.matches) return;
    burst(e.clientX, e.clientY, target.matches('.choice-card') ? 14 : 7);
  });

  // The listening woods: small lines from a shifting, original set of whispers.
  const whispers = [
    '“You cannot rescue what you refuse to remember.”',
    '“The dark is only a room where the light has not arrived yet.”',
    '“A promise can be a bridge. It can also become a cage.”',
    '“You are allowed to love someone and still let them go.”'
  ];
  let whisperIndex = 0;
  const whisperCard = $('#whisper-card');
  $('#listen-button').addEventListener('click', () => {
    whisperIndex = (whisperIndex + 1) % whispers.length;
    $('#whisper-text').textContent = whispers[whisperIndex];
    whisperCard.hidden = false;
    $('#listen-button').classList.add('path-shift');
    setTimeout(() => $('#listen-button').classList.remove('path-shift'), 650);
  });
  $('#whisper-close').addEventListener('click', () => { whisperCard.hidden = true; });

  // Clickable memory fragments at the lake.
  const memories = {
    home: { title: 'The House in Summer', body: 'The kitchen smelled of oranges and rain. Eli had stolen the last piece of toast, and their mother pretended not to notice. Mira had forgotten the sound of all three of them laughing at once. The lake returns it to her — not as a place she can go back to, but as proof that warmth once lived in her.' },
    brother: { title: 'Eli’s Last Promise', body: 'On the rooftop, Eli folded a scrap of silver paper into a moon. “If I ever get lost,” he said, “look for the thing that still glows.” Mira had thought he meant a star. Years later, she understands he meant the part of her that kept looking.' },
    self: { title: 'The Girl Who Stayed', body: 'She sees herself at seventeen, saying no to every invitation because grief had made the world feel dangerous. That girl was not weak. She was doing the only thing she knew how to do: making a small, quiet room around a hurt that had no name yet. Mira thanks her, then lets the room open.' }
  };
  const memoryReveal = $('#memory-reveal');
  $$('.memory-card').forEach(card => card.addEventListener('click', () => {
    const memory = memories[card.dataset.memory];
    if (!memory) return;
    $$('.memory-card').forEach(c => c.classList.toggle('selected', c === card));
    $('#memory-title').textContent = memory.title;
    $('#memory-body').textContent = memory.body;
    $('#memory-kicker').textContent = `MEMORY ${String(Object.keys(memories).indexOf(card.dataset.memory) + 1).padStart(2, '0')} / SURFACED`;
    memoryReveal.hidden = false;
    memoryReveal.scrollIntoView({ behavior: motionPaused ? 'auto' : 'smooth', block: 'nearest' });
  }));
  $('#memory-close').addEventListener('click', () => {
    memoryReveal.hidden = true;
    $$('.memory-card').forEach(c => c.classList.remove('selected'));
  });

  // Branching story. Each route changes the scene, dialogue and final reflection.
  const paths = {
    light: {
      label: 'PATH A / THE LIGHT', title: 'The light bends toward her.',
      text: 'Mira follows the falling stars to a garden suspended over the dark. Each star holds a dream someone once dared to begin. She finds Eli’s among them: not a memory of his face, but a small future in which he taught her to sail. The dream is not asking her to retrieve him. It is asking her to live the lesson.',
      ending: 'You chose the light: Mira learns that hope is not the promise that nothing will hurt again. It is the courage to imagine a life that still has room for wonder.'
    },
    shadow: {
      label: 'PATH B / THE SHADOW', title: 'The voice leads her beneath the roots.',
      text: 'Mira follows the voice into a quiet chamber where the forest keeps its oldest truths. Eli had not vanished because he stopped loving her. He had walked into the dream to hold back a darkness that was swallowing the sleeping city. The truth hurts — but it gives the years a shape she can finally understand.',
      ending: 'You chose the shadow: Mira learns that truth does not always make grief smaller. Sometimes it simply gives grief somewhere honest to stand.'
    },
    memory: {
      label: 'PATH C / THE MEMORY', title: 'The promise becomes a bridge.',
      text: 'Mira takes the paper moon from her pocket and remembers the words she left out: “If one of us finds the way home, we will leave a light for the other.” She places it on the water. The lake rises into a bridge, built from all the moments she thought were too small to matter.',
      ending: 'You chose the memory: Mira learns that remembering is not the same as refusing to move. The past can travel with her without deciding where she goes.'
    }
  };
  const choiceResult = $('#choice-result');
  $$('.choice-card').forEach(card => card.addEventListener('click', () => {
    currentChoice = card.dataset.choice;
    const path = paths[currentChoice];
    $$('.choice-card').forEach(c => { c.classList.toggle('selected', c === card); c.setAttribute('aria-pressed', String(c === card)); });
    $('#result-eyebrow').textContent = path.label;
    $('#result-title').textContent = path.title;
    $('#result-text').textContent = path.text;
    choiceResult.hidden = false;
    choiceResult.scrollIntoView({ behavior: motionPaused ? 'auto' : 'smooth', block: 'nearest' });
    $('#ending-path-note').hidden = true;
    showToast(`Path chosen: ${path.label.replace(/^PATH [A-C] \/ /, '')}`);
  }));
  $('#continue-choice').addEventListener('click', () => {
    if (!currentChoice) return;
    $('#ending-path-note').textContent = paths[currentChoice].ending;
    $('#ending-path-note').hidden = false;
    $('#ending-path-note').classList.remove('path-shift');
    void $('#ending-path-note').offsetWidth;
    $('#ending-path-note').classList.add('path-shift');
    $('#ending').scrollIntoView({ behavior: motionPaused ? 'auto' : 'smooth' });
  });
  $('#reset-choice').addEventListener('click', () => {
    currentChoice = null;
    choiceResult.hidden = true;
    $$('.choice-card').forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-pressed', 'false'); });
    showToast('The fork is open again. Choose another path.');
  });

  // The Keeper offers two responses; each has a different emotional consequence.
  const keeperDialogue = $('#keeper-dialogue');
  $('#keeper-button').addEventListener('click', () => { keeperDialogue.hidden = !keeperDialogue.hidden; });
  const keeperResponses = {
    release: 'The Keeper smiles, and for a moment he looks exactly like the brother Mira remembers. “Then you have finally found me,” he says. The citadel windows begin to glow. “Not here. In the life you carry on.”',
    hold: 'The Keeper reaches for her hand, but his fingers are made of starlight. “I know,” he says gently. “I wanted you to come. But a dream cannot be a home just because it is the last place we were together.”'
  };
  $$('[data-answer]').forEach(button => button.addEventListener('click', () => {
    $('#keeper-response').textContent = keeperResponses[button.dataset.answer];
    $('#keeper-response').hidden = false;
    $$('[data-answer]').forEach(b => b.disabled = true);
    showToast(button.dataset.answer === 'release' ? 'The citadel begins to wake.' : 'The dream holds its breath.');
  }));

  // Closing note and replay make the ending feel like a deliberate conclusion.
  $('#credits-button').addEventListener('click', () => {
    const note = $('#last-note');
    note.hidden = !note.hidden;
    if (!note.hidden) note.scrollIntoView({ behavior: motionPaused ? 'auto' : 'smooth', block: 'nearest' });
  });
  $('#replay-button').addEventListener('click', () => {
    currentChoice = null;
    choiceResult.hidden = true;
    memoryReveal.hidden = true;
    whisperCard.hidden = true;
    keeperDialogue.hidden = true;
    $('#keeper-response').hidden = true;
    $$('[data-answer]').forEach(b => b.disabled = false);
    $$('.choice-card').forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-pressed', 'false'); });
    $('#ending-path-note').hidden = true;
    $('#last-note').hidden = true;
    $$('.memory-card').forEach(c => c.classList.remove('selected'));
    window.scrollTo({ top: 0, behavior: motionPaused ? 'auto' : 'smooth' });
    showToast('The dream begins again. Your next choice can be different.');
  });

  // Small helper: feedback never blocks the story.
  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  // Subtle click ripple for large interactive surfaces.
  $$('.choice-card, .memory-card').forEach(el => el.addEventListener('click', e => {
    const rect = el.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple-click';
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    el.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }));
})();

// Memory object interaction: the scarf briefly returns a fragment of the past.
(() => {
  const button = document.getElementById('echo-button');
  const note = document.getElementById('echo-note');
  if (!button || !note) return;
  button.addEventListener('click', () => {
    const opening = note.hidden;
    note.hidden = !opening;
    button.setAttribute('aria-expanded', String(opening));
    button.innerHTML = opening
      ? '<span class="button-orb">✧</span> LET THE MEMORY REST <span class="button-arrow">↗</span>'
      : '<span class="button-orb">✧</span> TOUCH THE SCARF <span class="button-arrow">↗</span>';
  });
})();
